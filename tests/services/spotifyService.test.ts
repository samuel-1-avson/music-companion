import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Import after mock
import * as spotifyService from '../../services/spotifyService';

describe('spotifyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  describe('parseSpotifyToken', () => {
    it('should parse token from hash', () => {
      const hash = '#access_token=test_token&token_type=Bearer&expires_in=3600';
      const result = spotifyService.parseSpotifyToken(hash);
      
      expect(result).toBe('test_token');
    });

    it('should return null for empty hash', () => {
      const result = spotifyService.parseSpotifyToken('');
      
      expect(result).toBeNull();
    });

    it('should return null for hash without token', () => {
      const result = spotifyService.parseSpotifyToken('#error=access_denied');
      
      expect(result).toBeNull();
    });
  });

  describe('parseSpotifyError', () => {
    it('should parse error from hash', () => {
      const hash = '#error=access_denied&error_description=User%20denied%20access';
      const result = spotifyService.parseSpotifyError(hash);
      
      expect(result).toBeDefined();
    });

    it('should return null for hash without error', () => {
      const hash = '#access_token=test_token';
      const result = spotifyService.parseSpotifyError(hash);
      
      expect(result).toBeNull();
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile with token', async () => {
      const mockProfile = {
        display_name: 'Test User',
        email: 'test@example.com',
        images: []
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile
      });

      const result = await spotifyService.getUserProfile('test_token');
      
      expect(result).toEqual(mockProfile);
    });

    it('should return null on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const result = await spotifyService.getUserProfile('bad_token');
      expect(result).toBeNull();
    });
  });

  describe('getRecentlyPlayed', () => {
    it('should fetch recently played tracks', async () => {
      const mockResponse = {
        items: [
          {
            track: {
              id: 'track1',
              name: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              album: { images: [{ url: 'https://example.com/image.jpg' }] },
              duration_ms: 180000
            }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await spotifyService.getRecentlyPlayed('test_token', 10);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('searchSpotifyTrack', () => {
    it('should search for tracks', async () => {
      const mockResponse = {
        tracks: {
          items: [
            {
              id: 'track1',
              name: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              album: { images: [{ url: 'https://example.com/image.jpg' }] },
              duration_ms: 180000
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await spotifyService.searchSpotifyTrack('test query', 'test_token');
      
      expect(result).toBeDefined();
    });

    it('should return null for empty query', async () => {
      const result = await spotifyService.searchSpotifyTrack('', 'test_token');
      
      expect(result).toBeNull();
    });
  });
});
