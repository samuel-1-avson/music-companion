/**
 * Telegram Integration Routes
 * Handles direct connection flow without manual chat ID entry
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../utils/config.js';

const router = Router();

// In-memory storage for pending verifications
// In production, use Redis or database
const pendingVerifications = new Map<string, {
  userId: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
}>();

// Cleanup expired verifications every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [code, verification] of pendingVerifications.entries()) {
    if (now > verification.expiresAt) {
      pendingVerifications.delete(code);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get Telegram bot info
 * GET /auth/telegram/bot-info
 */
router.get('/bot-info', async (req: Request, res: Response) => {
  if (!config.telegram?.botToken) {
    return res.status(503).json({ 
      success: false, 
      error: 'Telegram bot not configured' 
    });
  }

  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${config.telegram.botToken}/getMe`
    );

    if (response.data.ok) {
      res.json({
        success: true,
        data: {
          username: response.data.result.username,
          firstName: response.data.result.first_name,
        }
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to get bot info' });
    }
  } catch (err: any) {
    console.error('[Telegram] Bot info error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get bot info' });
  }
});

/**
 * Generate verification code for linking
 * POST /auth/telegram/generate-code
 * Body: { userId: string }
 */
router.post('/generate-code', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }

  if (!config.telegram?.botToken) {
    return res.status(503).json({ 
      success: false, 
      error: 'Telegram bot not configured' 
    });
  }

  // Generate a short, user-friendly code
  const code = uuidv4().split('-')[0].toUpperCase(); // e.g., "A1B2C3D4"
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  // Clear any existing verification for this user
  for (const [existingCode, verification] of pendingVerifications.entries()) {
    if (verification.userId === userId) {
      pendingVerifications.delete(existingCode);
    }
  }

  // Store the verification
  pendingVerifications.set(code, {
    userId,
    code,
    createdAt: now,
    expiresAt,
  });

  // Get bot username for the deep link
  try {
    const botResponse = await axios.get(
      `https://api.telegram.org/bot${config.telegram.botToken}/getMe`
    );

    if (botResponse.data.ok) {
      const botUsername = botResponse.data.result.username;
      const deepLink = `https://t.me/${botUsername}?start=${code}`;

      res.json({
        success: true,
        data: {
          code,
          deepLink,
          botUsername,
          expiresIn: 600, // 10 minutes in seconds
        }
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to get bot info' });
    }
  } catch (err: any) {
    console.error('[Telegram] Generate code error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate code' });
  }
});

/**
 * Check verification status (polling endpoint)
 * GET /auth/telegram/status/:code
 */
router.get('/status/:code', async (req: Request, res: Response) => {
  const { code } = req.params;
  const upperCode = code.toUpperCase();

  const verification = pendingVerifications.get(upperCode);

  if (!verification) {
    return res.json({
      success: true,
      data: {
        status: 'not_found',
        message: 'Verification code not found or expired'
      }
    });
  }

  // Check if expired
  if (new Date() > verification.expiresAt) {
    pendingVerifications.delete(upperCode);
    return res.json({
      success: true,
      data: {
        status: 'expired',
        message: 'Verification code has expired'
      }
    });
  }

  // Still pending - user hasn't messaged the bot yet
  res.json({
    success: true,
    data: {
      status: 'pending',
      message: 'Waiting for user to message the bot'
    }
  });
});

/**
 * Long-polling for Telegram updates
 * This checks for new messages to the bot
 * POST /auth/telegram/poll-updates
 */
let lastUpdateId = 0;

router.post('/poll-updates', async (req: Request, res: Response) => {
  if (!config.telegram?.botToken) {
    return res.status(503).json({ 
      success: false, 
      error: 'Telegram bot not configured' 
    });
  }

  try {
    // Get updates from Telegram
    const response = await axios.get(
      `https://api.telegram.org/bot${config.telegram.botToken}/getUpdates`,
      {
        params: {
          offset: lastUpdateId + 1,
          timeout: 1,
          allowed_updates: ['message']
        },
        timeout: 5000
      }
    );

    if (response.data.ok && response.data.result.length > 0) {
      const linkedUsers: Array<{ chatId: string; username: string; code: string }> = [];

      for (const update of response.data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);

        const message = update.message;
        if (!message || !message.text) continue;

        // Check for /start command with verification code
        const startMatch = message.text.match(/^\/start\s+(\w+)$/i);
        
        if (startMatch) {
          const code = startMatch[1].toUpperCase();
          const verification = pendingVerifications.get(code);

          if (verification && new Date() < verification.expiresAt) {
            const chatId = message.chat.id.toString();
            const username = message.from.username || message.from.first_name || `User ${chatId}`;

            // Save to Supabase
            const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
            
            try {
              await axios.post(
                `${config.supabase.url}/rest/v1/user_integrations`,
                {
                  user_id: verification.userId,
                  provider: 'telegram',
                  provider_user_id: chatId,
                  provider_username: username,
                  metadata: { 
                    chat_id: chatId,
                    username: message.from.username,
                    first_name: message.from.first_name,
                    linked_via: 'verification_code'
                  },
                  connected_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                  }
                }
              );

              // Send confirmation message to user
              await axios.post(
                `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
                {
                  chat_id: chatId,
                  text: '✅ *Successfully connected to Music Companion!*\n\nYou will now receive notifications about your music activity.',
                  parse_mode: 'Markdown'
                }
              );

              linkedUsers.push({ chatId, username, code });
              
              // Remove the verification (it's been used)
              pendingVerifications.delete(code);
              
              console.log(`[Telegram] Linked user ${verification.userId} with chat ${chatId}`);

            } catch (saveErr: any) {
              console.error('[Telegram] Save integration error:', saveErr.response?.data || saveErr.message);
            }
          } else if (!verification) {
            // Send message that code is invalid
            await axios.post(
              `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
              {
                chat_id: message.chat.id,
                text: '❌ Invalid or expired verification code.\n\nPlease go back to Music Companion and click "Connect Telegram" again.',
                parse_mode: 'Markdown'
              }
            );
          }
        } else if (message.text === '/start') {
          // User started without a code
          await axios.post(
            `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`,
            {
              chat_id: message.chat.id,
              text: '👋 *Welcome to Music Companion Bot!*\n\nTo connect your account, please use the "Connect Telegram" button in the Music Companion app.',
              parse_mode: 'Markdown'
            }
          );
        }
      }

      res.json({
        success: true,
        data: {
          processed: response.data.result.length,
          linked: linkedUsers
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          processed: 0,
          linked: []
        }
      });
    }
  } catch (err: any) {
    console.error('[Telegram] Poll error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to poll updates' });
  }
});

/**
 * Verify a code was successfully linked
 * GET /auth/telegram/verify/:code
 */
router.get('/verify/:code', async (req: Request, res: Response) => {
  const { code } = req.params;
  const upperCode = code.toUpperCase();

  // If code is no longer in pending, it was either used or expired
  const verification = pendingVerifications.get(upperCode);

  if (!verification) {
    // Code not found - could be successfully linked or expired
    // Check if the user has a telegram integration
    res.json({
      success: true,
      data: {
        status: 'completed',
        message: 'Verification code has been processed'
      }
    });
  } else if (new Date() > verification.expiresAt) {
    pendingVerifications.delete(upperCode);
    res.json({
      success: true,
      data: {
        status: 'expired',
        message: 'Verification code has expired'
      }
    });
  } else {
    res.json({
      success: true,
      data: {
        status: 'pending',
        message: 'Waiting for verification'
      }
    });
  }
});

export default router;
