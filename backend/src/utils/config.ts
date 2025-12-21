/**
 * Configuration and Environment Variables
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  FRONTEND_URLS: z.string().optional(), // Comma-separated list of additional frontend URLs
  BACKEND_URL: z.string().optional(), // Backend public URL for OAuth callbacks
  
  // Spotify
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().default('http://localhost:3001/auth/spotify/callback'),
  
  // Last.fm
  LASTFM_API_KEY: z.string().optional(),
  LASTFM_SHARED_SECRET: z.string().optional(),
  
  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),
  
  // Discord
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  
  // YouTube Data API
  YOUTUBE_API_KEY: z.string().optional(),
  
  // Google OAuth (for YouTube)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  
  // Resend Email Service
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('noreply@yourdomain.com'),
  
  // Supabase
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Security
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  frontendUrl: parsed.data.FRONTEND_URL,
  // All allowed frontend URLs for CORS (includes primary + additional)
  frontendUrls: [
    parsed.data.FRONTEND_URL,
    'http://localhost:3004', // Vite alternate port
    'http://localhost:3000', // Another common port
    ...(parsed.data.FRONTEND_URLS ? parsed.data.FRONTEND_URLS.split(',').map(u => u.trim()) : [])
  ].filter(Boolean),
  backendUrl: parsed.data.BACKEND_URL || `http://localhost:${parsed.data.PORT}`,
  isDev: parsed.data.NODE_ENV === 'development',
  isProd: parsed.data.NODE_ENV === 'production',
  
  spotify: {
    clientId: parsed.data.SPOTIFY_CLIENT_ID || '',
    clientSecret: parsed.data.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: parsed.data.SPOTIFY_REDIRECT_URI,
    isConfigured: !!(parsed.data.SPOTIFY_CLIENT_ID && parsed.data.SPOTIFY_CLIENT_SECRET),
  },
  
  lastfm: {
    apiKey: parsed.data.LASTFM_API_KEY || '',
    sharedSecret: parsed.data.LASTFM_SHARED_SECRET || '',
    isConfigured: !!(parsed.data.LASTFM_API_KEY && parsed.data.LASTFM_SHARED_SECRET),
  },
  
  gemini: {
    apiKey: parsed.data.GEMINI_API_KEY || '',
    isConfigured: !!parsed.data.GEMINI_API_KEY,
  },
  
  discord: {
    clientId: parsed.data.DISCORD_CLIENT_ID || '',
    clientSecret: parsed.data.DISCORD_CLIENT_SECRET || '',
    isConfigured: !!(parsed.data.DISCORD_CLIENT_ID && parsed.data.DISCORD_CLIENT_SECRET),
  },
  
  youtube: {
    apiKey: parsed.data.YOUTUBE_API_KEY || '',
    clientId: parsed.data.GOOGLE_CLIENT_ID || '',
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET || '',
    isConfigured: !!(parsed.data.GOOGLE_CLIENT_ID && parsed.data.GOOGLE_CLIENT_SECRET),
  },
  
  resend: {
    apiKey: parsed.data.RESEND_API_KEY || '',
    fromEmail: parsed.data.RESEND_FROM_EMAIL,
    isConfigured: !!parsed.data.RESEND_API_KEY,
  },
  
  telegram: {
    botToken: parsed.data.TELEGRAM_BOT_TOKEN || '',
    isConfigured: !!parsed.data.TELEGRAM_BOT_TOKEN,
  },
  
  supabase: {
    url: parsed.data.SUPABASE_URL || '',
    anonKey: parsed.data.SUPABASE_ANON_KEY || '',
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY || '',
    isConfigured: !!(parsed.data.SUPABASE_URL && parsed.data.SUPABASE_ANON_KEY),
  },
  
  security: {
    encryptionKey: parsed.data.TOKEN_ENCRYPTION_KEY || '',
    isEncryptionConfigured: !!(parsed.data.TOKEN_ENCRYPTION_KEY && parsed.data.TOKEN_ENCRYPTION_KEY.length >= 32),
  },
};

export type Config = typeof config;

