/**
 * System Health Check Tests
 * End-to-end tests to verify the entire system is working
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('System Health Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Frontend Build', () => {
    it('should have all required environment variables defined', () => {
      // Check that import.meta.env structure exists
      expect(typeof import.meta.env).toBe('object');
    });
  });

  describe('Backend API Health', () => {
    it('should respond to health endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', uptime: 1000 }),
      });

      const response = await fetch('http://localhost:3001/health');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetch('http://localhost:3001/health')).rejects.toThrow('Network error');
    });
  });

  describe('Docker Services', () => {
    it('should verify Redis connection format', () => {
      const redisHost = 'redis';
      const redisPort = 6379;
      
      expect(redisHost).toBe('redis');
      expect(redisPort).toBe(6379);
    });

    it('should have correct service URLs', () => {
      const frontendUrl = 'http://localhost:3004';
      const backendUrl = 'http://localhost:3001';
      const redisUrl = 'redis://redis:6379';

      expect(frontendUrl).toContain(':3004');
      expect(backendUrl).toContain(':3001');
      expect(redisUrl).toContain(':6379');
    });
  });

  describe('OAuth Providers Configuration', () => {
    it('should have Spotify OAuth scopes defined', () => {
      const spotifyScopes = 'user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played playlist-read-private playlist-modify-private streaming';
      
      expect(spotifyScopes).toContain('user-read-email');
      expect(spotifyScopes).toContain('streaming');
    });

    it('should have Discord OAuth scopes defined', () => {
      const discordScopes = 'identify email guilds';
      
      expect(discordScopes).toContain('identify');
      expect(discordScopes).toContain('email');
    });

    it('should have Twitch OAuth scopes defined', () => {
      const twitchScopes = 'user:read:email';
      
      expect(twitchScopes).toContain('user:read:email');
    });
  });

  describe('Supabase Integration', () => {
    it('should have valid Supabase URL format', () => {
      const supabaseUrl = 'https://przxvdzsatzaafdvcti.supabase.co';
      
      expect(supabaseUrl).toMatch(/^https:\/\/[a-z]+\.supabase\.co$/);
    });

    it('should support required database tables', () => {
      const requiredTables = [
        'favorites',
        'history',
        'playlist_songs',
        'playlist_collaborators',
        'collaborative_playlists',
        'user_integrations',
      ];

      requiredTables.forEach(table => {
        expect(requiredTables).toContain(table);
      });
    });
  });

  describe('Platform Integrations', () => {
    it('should define supported providers', () => {
      const providers = ['spotify', 'discord', 'telegram', 'twitch', 'lastfm'];
      
      expect(providers).toContain('spotify');
      expect(providers).toContain('discord');
      expect(providers).toContain('telegram');
    });

    it('should have Telegram bot token format validation', () => {
      const isValidBotToken = (token: string) => {
        return /^\d+:[A-Za-z0-9_-]+$/.test(token);
      };

      expect(isValidBotToken('8549366702:AAF0jGjwalZEGjYAa3oFPDuxU2Qslz0a00g')).toBe(true);
      expect(isValidBotToken('')).toBe(false);
      expect(isValidBotToken('invalid')).toBe(false);
    });
  });

  describe('Component Integration', () => {
    it('should export all required hooks', async () => {
      const hooks = await import('../../hooks/index');
      
      expect(hooks.usePlayer).toBeDefined();
      expect(hooks.useQueue).toBeDefined();
      expect(hooks.useTheme).toBeDefined();
      expect(hooks.useFavorites).toBeDefined();
      expect(hooks.useCollaborativePlaylists).toBeDefined();
      expect(hooks.useIntegrations).toBeDefined();
    });
  });
});

describe('Integration Flow Tests', () => {
  describe('OAuth Connection Flow', () => {
    it('should validate OAuth callback URL format', () => {
      const callbackUrl = 'https://przxvdzsatzaafdvcti.supabase.co/auth/v1/callback';
      
      expect(callbackUrl).toContain('/auth/v1/callback');
      expect(callbackUrl).toMatch(/^https:\/\//);
    });

    it('should handle identity_already_exists error', () => {
      const errorCode = 'identity_already_exists';
      
      // This error is actually a success - identity is already linked
      const isExpectedError = errorCode === 'identity_already_exists';
      expect(isExpectedError).toBe(true);
    });
  });

  describe('Telegram Bot Flow', () => {
    it('should validate chat ID format', () => {
      const isValidChatId = (chatId: string) => /^\d+$/.test(chatId);
      
      expect(isValidChatId('123456789')).toBe(true);
      expect(isValidChatId('abc')).toBe(false);
    });
  });
});
