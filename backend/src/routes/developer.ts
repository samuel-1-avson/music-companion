/**
 * Developer API Routes
 * External API for third-party developers
 */
import { Router } from 'express';
import { getCurrentState, broadcastSongChange, broadcastQueueUpdate } from '../services/websocket.js';
import type { Song, ApiKey, ApiScope, ApiResponse } from '../types/index.js';

const router = Router();

// In-memory API key store (in production, use database)
const apiKeys = new Map<string, ApiKey>();

// Rate limiting (simple in-memory, use Redis in production)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// --- MIDDLEWARE ---

/**
 * Validate API key and check scopes
 */
function requireAuth(...requiredScopes: ApiScope[]) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing API key' });
    }

    const key = authHeader.replace('Bearer ', '');
    const apiKey = findApiKeyByKey(key);

    if (!apiKey) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }

    // Check rate limit
    const rateKey = apiKey.id;
    const now = Date.now();
    const limit = rateLimits.get(rateKey);

    if (limit && limit.resetAt > now && limit.count >= 1000) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
    }

    if (!limit || limit.resetAt <= now) {
      rateLimits.set(rateKey, { count: 1, resetAt: now + 60000 });
    } else {
      limit.count++;
    }

    // Check scopes
    if (requiredScopes.length > 0) {
      const hasScopes = requiredScopes.every(s => apiKey.scopes.includes(s));
      if (!hasScopes) {
        return res.status(403).json({ 
          success: false, 
          error: `Missing required scopes: ${requiredScopes.join(', ')}` 
        });
      }
    }

    // Update last used
    apiKey.lastUsed = Date.now();
    req.apiKey = apiKey;
    next();
  };
}

function findApiKeyByKey(key: string): ApiKey | undefined {
  for (const apiKey of apiKeys.values()) {
    if (apiKey.key === key) return apiKey;
  }
  return undefined;
}

// --- API KEY MANAGEMENT ---

/**
 * Create new API key
 * POST /api/dev/keys
 */
router.post('/keys', (req, res) => {
  const { name, scopes } = req.body;

  if (!name || !scopes || !Array.isArray(scopes)) {
    return res.status(400).json({ success: false, error: 'Missing name or scopes' });
  }

  const validScopes: ApiScope[] = ['player:read', 'player:control', 'queue:manage', 'ai:generate'];
  const filteredScopes = scopes.filter(s => validScopes.includes(s));

  if (filteredScopes.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid scopes provided' });
  }

  const newKey: ApiKey = {
    id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name,
    key: generateSecureKey(),
    scopes: filteredScopes,
    createdAt: Date.now()
  };

  apiKeys.set(newKey.id, newKey);

  res.json({ success: true, data: newKey });
});

/**
 * List all API keys (without full key)
 * GET /api/dev/keys
 */
router.get('/keys', (req, res) => {
  const keys = Array.from(apiKeys.values()).map(k => ({
    id: k.id,
    name: k.name,
    scopes: k.scopes,
    createdAt: k.createdAt,
    lastUsed: k.lastUsed,
    keyPreview: k.key.substring(0, 10) + '...'
  }));

  res.json({ success: true, data: keys });
});

/**
 * Revoke an API key
 * DELETE /api/dev/keys/:id
 */
router.delete('/keys/:id', (req, res) => {
  const { id } = req.params;
  
  if (apiKeys.has(id)) {
    apiKeys.delete(id);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Key not found' });
  }
});

// --- PLAYER CONTROL ---

/**
 * Get current song
 * GET /api/dev/player/current
 */
router.get('/player/current', requireAuth('player:read'), (req, res) => {
  const state = getCurrentState();
  res.json({ success: true, data: state.song });
});

/**
 * Get playback state
 * GET /api/dev/player/state
 */
router.get('/player/state', requireAuth('player:read'), (req, res) => {
  const state = getCurrentState();
  res.json({ success: true, data: state.playback });
});

/**
 * Play/resume
 * POST /api/dev/player/play
 */
router.post('/player/play', requireAuth('player:control'), (req, res) => {
  const { songId } = req.body;
  // In production, this would emit to connected clients
  res.json({ success: true, message: songId ? `Playing ${songId}` : 'Resumed playback' });
});

/**
 * Pause
 * POST /api/dev/player/pause
 */
router.post('/player/pause', requireAuth('player:control'), (req, res) => {
  res.json({ success: true, message: 'Paused playback' });
});

/**
 * Next track
 * POST /api/dev/player/next
 */
router.post('/player/next', requireAuth('player:control'), (req, res) => {
  res.json({ success: true, message: 'Skipped to next' });
});

/**
 * Previous track
 * POST /api/dev/player/previous
 */
router.post('/player/previous', requireAuth('player:control'), (req, res) => {
  res.json({ success: true, message: 'Went to previous' });
});

// --- QUEUE MANAGEMENT ---

/**
 * Get queue
 * GET /api/dev/queue
 */
router.get('/queue', requireAuth('queue:manage'), (req, res) => {
  const state = getCurrentState();
  res.json({ success: true, data: state.queue });
});

/**
 * Add to queue
 * POST /api/dev/queue
 */
router.post('/queue', requireAuth('queue:manage'), (req, res) => {
  const song = req.body as Song;
  
  if (!song.id || !song.title) {
    return res.status(400).json({ success: false, error: 'Invalid song data' });
  }

  const state = getCurrentState();
  const newQueue = [...state.queue, song];
  broadcastQueueUpdate(newQueue);

  res.json({ success: true, message: 'Added to queue' });
});

/**
 * Remove from queue
 * DELETE /api/dev/queue/:songId
 */
router.delete('/queue/:songId', requireAuth('queue:manage'), (req, res) => {
  const { songId } = req.params;
  const state = getCurrentState();
  const newQueue = state.queue.filter(s => s.id !== songId);
  broadcastQueueUpdate(newQueue);

  res.json({ success: true, message: 'Removed from queue' });
});

// --- MOOD DATA ---

/**
 * Get mood history
 * GET /api/dev/mood
 */
router.get('/mood', requireAuth('player:read'), (req, res) => {
  const state = getCurrentState();
  res.json({ success: true, data: state.mood });
});

// --- EXTENSION CONTEXT ---

// Store latest context from extensions
let extensionContext: {
  vscode?: { activity: string; mood: string; language: string; timestamp: number };
  browser?: { category: string; mood: string; url: string; timestamp: number };
} = {};

/**
 * Receive context from extensions (no auth required for extensions)
 * POST /api/dev/context
 */
router.post('/context', (req, res) => {
  const { source, ...data } = req.body;
  
  if (!source) {
    return res.status(400).json({ success: false, error: 'Missing source' });
  }
  
  if (source === 'vscode') {
    extensionContext.vscode = {
      activity: data.activity || 'coding',
      mood: data.mood || 'focused',
      language: data.language || 'unknown',
      timestamp: Date.now()
    };
    console.log(`[Context] VS Code: ${data.activity} (${data.language}) - ${data.mood}`);
  } else if (source === 'browser') {
    extensionContext.browser = {
      category: data.category || 'default',
      mood: data.mood || 'ambient',
      url: data.url || '',
      timestamp: Date.now()
    };
    console.log(`[Context] Browser: ${data.category} - ${data.mood}`);
  }
  
  res.json({ success: true, message: 'Context received' });
});

/**
 * Get current extension context
 * GET /api/dev/context
 */
router.get('/context', (req, res) => {
  res.json({ success: true, data: extensionContext });
});

// --- UTILS ---

function generateSecureKey(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const base64 = Buffer.from(array).toString('base64');
  return `mc_${base64.replace(/[+/=]/g, '').substring(0, 32)}`;
}

export default router;
