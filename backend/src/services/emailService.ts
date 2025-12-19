/**
 * Email Service using Resend
 * Handles sending verification codes for integration linking
 */
import { config } from '../utils/config.js';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using Resend API
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!config.resend.isConfigured) {
    console.error('[Email] Resend not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resend.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Email] Failed to send:', error);
      return false;
    }

    console.log('[Email] Sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('[Email] Error:', error);
    return false;
  }
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code email for integration linking
 */
export async function sendVerificationCodeEmail(
  to: string,
  code: string,
  provider: string,
  userEmail: string
): Promise<boolean> {
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; 
                padding: 20px; background: #1DB954; color: white; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎵 Music Companion</h1>
      </div>
      <div class="content">
        <h2>Verify Your ${providerName} Account</h2>
        <p>Someone is trying to link this ${providerName} account to a Music Companion account with a different email address.</p>
        
        <div class="warning">
          <strong>⚠️ Different Email Detected</strong><br>
          Music Companion account: <strong>${userEmail}</strong><br>
          ${providerName} account: <strong>${to}</strong>
        </div>
        
        <p>If this is you, enter this verification code in the app:</p>
        
        <div class="code">${code}</div>
        
        <p><strong>This code expires in 10 minutes.</strong></p>
        
        <p>If you didn't request this, please ignore this email.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Music Companion. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `[Music Companion] Verify your ${providerName} account - Code: ${code}`,
    html,
  });
}
