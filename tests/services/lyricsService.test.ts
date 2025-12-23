import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getLyrics, 
  searchLyrics, 
  parseSyncedLyrics, 
  parsePlainLyrics, 
  getCurrentLyricIndex,
  LyricLine 
} from '../../services/lyricsService';

describe('Lyrics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseSyncedLyrics', () => {
    it('should parse LRC format correctly', () => {
      const lrc = `[00:12.34]First line
[00:15.67]Second line
[00:20.00]Third line`;

      const result = parseSyncedLyrics(lrc);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ time: 12.34, text: 'First line' });
      expect(result[1]).toEqual({ time: 15.67, text: 'Second line' });
      expect(result[2]).toEqual({ time: 20, text: 'Third line' });
    });

    it('should handle empty lines', () => {
      const lrc = `[00:10.00]Line with text
[00:15.00]
[00:20.00]Another line`;

      const result = parseSyncedLyrics(lrc);

      // Empty text lines should be filtered out
      expect(result.some(l => l.text === '')).toBe(false);
    });

    it('should sort lines by time', () => {
      const lrc = `[00:20.00]Third
[00:10.00]First
[00:15.00]Second`;

      const result = parseSyncedLyrics(lrc);

      expect(result[0].text).toBe('First');
      expect(result[1].text).toBe('Second');
      expect(result[2].text).toBe('Third');
    });

    it('should handle milliseconds with 2 or 3 digits', () => {
      const lrc = `[00:10.12]Two digits
[00:15.123]Three digits`;

      const result = parseSyncedLyrics(lrc);

      expect(result[0].time).toBeCloseTo(10.12, 2);
      expect(result[1].time).toBeCloseTo(15.123, 3);
    });
  });

  describe('parsePlainLyrics', () => {
    it('should split lyrics into lines', () => {
      const lyrics = `Line 1
Line 2
Line 3`;

      const result = parsePlainLyrics(lyrics);

      expect(result).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter empty lines', () => {
      const lyrics = `Line 1

Line 2
   
Line 3`;

      const result = parsePlainLyrics(lyrics);

      expect(result).toHaveLength(3);
    });
  });

  describe('getCurrentLyricIndex', () => {
    const lyrics: LyricLine[] = [
      { time: 10, text: 'Line 1' },
      { time: 20, text: 'Line 2' },
      { time: 30, text: 'Line 3' },
    ];

    it('should return -1 before first lyric', () => {
      expect(getCurrentLyricIndex(lyrics, 5)).toBe(-1);
    });

    it('should return correct index during song', () => {
      expect(getCurrentLyricIndex(lyrics, 10)).toBe(0);
      expect(getCurrentLyricIndex(lyrics, 15)).toBe(0);
      expect(getCurrentLyricIndex(lyrics, 20)).toBe(1);
      expect(getCurrentLyricIndex(lyrics, 25)).toBe(1);
      expect(getCurrentLyricIndex(lyrics, 30)).toBe(2);
      expect(getCurrentLyricIndex(lyrics, 100)).toBe(2);
    });

    it('should handle empty lyrics array', () => {
      expect(getCurrentLyricIndex([], 10)).toBe(-1);
    });
  });

  describe('getLyrics', () => {
    it('should call LRCLIB API with correct parameters', async () => {
      const mockResponse = {
        id: 1,
        trackName: 'Test Song',
        artistName: 'Test Artist',
        syncedLyrics: '[00:10.00]Test lyrics',
        plainLyrics: 'Test lyrics',
        instrumental: false,
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getLyrics('Test Song', 'Test Artist');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://lrclib.net/api/get'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return null on 404', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getLyrics('Unknown Song', 'Unknown Artist');

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await getLyrics('Test Song', 'Test Artist');

      expect(result).toBeNull();
    });
  });

  describe('searchLyrics', () => {
    it('should search lyrics and return results', async () => {
      const mockResults = [
        { id: 1, trackName: 'Song 1', artistName: 'Artist 1' },
        { id: 2, trackName: 'Song 2', artistName: 'Artist 2' },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await searchLyrics('test query');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search?q=test%20query'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResults);
    });

    it('should return empty array on error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await searchLyrics('test query');

      expect(result).toEqual([]);
    });
  });
});
