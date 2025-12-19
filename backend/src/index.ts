/**
 * Music Companion Backend Server
 * Main entry point
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from './utils/config.js';
import { setupWebSocket } from './services/websocket.js';
import { initializeDiscord, isDiscordConnected } from './services/discord.js';

// Import routes
import authRoutes from './routes/auth.js';
import musicRoutes from './routes/music.js';
import aiRoutes from './routes/ai.js';
import developerRoutes from './routes/developer.js';
import webhookRoutes from './routes/webhooks.js';
import downloadsRoutes from './routes/downloads.js';
import telegramRoutes from './routes/telegram.js';

// Import middleware
import { authRateLimit, aiRateLimit, downloadRateLimit, searchRateLimit, generalRateLimit } from './middleware/rateLimitMiddleware.js';

// Import types
import type { ServerToClientEvents, ClientToServerEvents } from './types/index.js';

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: config.isDev ? true : config.frontendUrls,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// --- MIDDLEWARE ---

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS - Allow multiple frontend URLs for development flexibility
app.use(cors({
  origin: config.isDev ? true : config.frontendUrls,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (dev only)
if (config.isDev) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// --- ROUTES ---

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      spotify: config.spotify.isConfigured,
      lastfm: config.lastfm.isConfigured,
      gemini: config.gemini.isConfigured,
      discord: config.discord.isConfigured,
      youtube: config.youtube.isConfigured,
      telegram: config.telegram.isConfigured
    }
  });
});

// API info
app.get('/', (req, res) => {
  res.json({
    name: 'Music Companion API',
    version: '1.0.0',
    docs: '/docs',
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      music: '/api/music/*',
      ai: '/api/ai/*',
      developer: '/api/dev/*',
      webhooks: '/api/webhooks/*'
    }
  });
});

// Mount route modules with rate limiting
app.use('/auth', authRateLimit, authRoutes);
app.use('/api/music', searchRateLimit, musicRoutes);
app.use('/api/ai', aiRateLimit, aiRoutes);
app.use('/api/dev', generalRateLimit, developerRoutes);
app.use('/api/webhooks', generalRateLimit, webhookRoutes);
app.use('/api/downloads', downloadRateLimit, downloadsRoutes);
app.use('/auth/telegram', authRateLimit, telegramRoutes);

// --- ERROR HANDLING ---

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: config.isDev ? err.message : 'Internal server error'
  });
});

// --- WEBSOCKET ---

setupWebSocket(io);

// --- START SERVER ---

httpServer.listen(config.port, async () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║          🎵 Music Companion Backend 🎵            ║
╠═══════════════════════════════════════════════════╣
║  Server:    http://localhost:${config.port}                 ║
║  Frontend:  ${config.frontendUrl}              ║
║  Mode:      ${config.nodeEnv.padEnd(11)}                       ║
╠═══════════════════════════════════════════════════╣
║  Services:                                        ║
║    Spotify:  ${config.spotify.isConfigured ? '✓ Configured' : '✗ Not configured'}                    ║
║    Last.fm:  ${config.lastfm.isConfigured ? '✓ Configured' : '✗ Not configured'}                    ║
║    Gemini:   ${config.gemini.isConfigured ? '✓ Configured' : '✗ Not configured'}                    ║
║    Discord:  ${config.discord.isConfigured ? '✓ Configured' : '✗ Not configured'}                    ║
╚═══════════════════════════════════════════════════╝
  `);
  
  // Initialize Discord RPC if configured
  if (config.discord.isConfigured) {
    const discordConnected = await initializeDiscord();
    if (discordConnected) {
      console.log('✓ Discord Rich Presence connected');
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, io };
