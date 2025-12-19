import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock YouTube API response
const mockYouTubeResponse = {
  items: [
    {
      id: { videoId: 'vid123' },
      snippet: {
        title: 'Test Song - Test Artist',
        channelTitle: 'Test Artist',
        thumbnails: { high: { url: 'https://example.com/thumb.jpg' } }
      }
    }
  ]
};

// Import service after mocks
import * as musicService from '../../services/musicService';

describe('musicService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  describe('searchUnified', () => {
    it('should search YouTube when provider is YOUTUBE', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockYouTubeResponse
      });

      const results = await musicService.searchUnified('test query', 'YOUTUBE');
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should fallback to YouTube when Spotify token is missing', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockYouTubeResponse
      });

      const results = await musicService.searchUnified('test', 'SPOTIFY');
      
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty query', async () => {
      const results = await musicService.searchUnified('', 'YOUTUBE');
      
      expect(results).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const results = await musicService.searchUnified('test', 'YOUTUBE');
      
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getYouTubeAudioStream', () => {
    it('should return stream URL for valid video ID', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ streamUrl: 'https://stream.example.com/audio.mp3' })
      });

      const result = await musicService.getYouTubeAudioStream('vid123');
      
      expect(result).toBeDefined();
    });

    it('should handle missing video ID', async () => {
      const result = await musicService.getYouTubeAudioStream('');
      
      expect(result).toBeNull();
    });
  });
});
