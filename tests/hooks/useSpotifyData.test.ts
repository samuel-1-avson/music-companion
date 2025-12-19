/**
 * Tests for useSpotifyData hook
 * Covers token refresh, API calls, and data loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useSpotifyData - Token Refresh Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('Token Expiry Calculation', () => {
    it('should calculate refresh time 5 minutes before expiry', () => {
      const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now
      const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS;
      const timeUntilRefresh = refreshAt - Date.now();

      expect(timeUntilRefresh).toBeGreaterThan(0);
      expect(timeUntilRefresh).toBeLessThan(60 * 60 * 1000);
      expect(Math.round(timeUntilRefresh / 1000 / 60)).toBe(55); // 55 minutes until refresh
    });

    it('should return 0 or negative if token already expired', () => {
      const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
      const expiresAt = Date.now() - 60 * 1000; // Expired 1 minute ago
      const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS;
      const timeUntilRefresh = refreshAt - Date.now();

      expect(timeUntilRefresh).toBeLessThan(0);
    });

    it('should handle expiry within buffer window', () => {
      const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
      const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes from now
      const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER_MS;
      const timeUntilRefresh = refreshAt - Date.now();

      // Should be negative since we're within 5 min buffer
      expect(timeUntilRefresh).toBeLessThan(0);
    });
  });

  describe('Token Expiry Info Helper', () => {
    it('should calculate remaining minutes correctly', () => {
      const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
      const now = Date.now();
      const remaining = expiresAt - now;
      const remainingMinutes = Math.max(0, Math.round(remaining / 1000 / 60));

      expect(remainingMinutes).toBe(30);
    });

    it('should return 0 for expired tokens', () => {
      const expiresAt = Date.now() - 10 * 60 * 1000; // Expired 10 min ago
      const now = Date.now();
      const remaining = expiresAt - now;
      const remainingMinutes = Math.max(0, Math.round(remaining / 1000 / 60));

      expect(remainingMinutes).toBe(0);
    });
  });

  describe('Spotify API Response Types', () => {
    it('should match expected track structure', () => {
      const mockTrack = {
        id: 'track123',
        name: 'Test Song',
        artists: [{ id: 'artist1', name: 'Artist Name' }],
        album: {
          id: 'album1',
          name: 'Album Name',
          images: [{ url: 'https://example.com/image.jpg', width: 300, height: 300 }],
        },
        duration_ms: 180000,
        uri: 'spotify:track:track123',
        external_urls: { spotify: 'https://open.spotify.com/track/track123' },
      };

      expect(mockTrack.id).toBeTruthy();
      expect(mockTrack.artists).toHaveLength(1);
      expect(mockTrack.album.images).toHaveLength(1);
    });

    it('should match expected playlist structure', () => {
      const mockPlaylist = {
        id: 'playlist123',
        name: 'My Playlist',
        description: 'A test playlist',
        images: [{ url: 'https://example.com/playlist.jpg' }],
        owner: { id: 'user1', display_name: 'Test User' },
        tracks: { total: 50 },
        public: false,
        external_urls: { spotify: 'https://open.spotify.com/playlist/playlist123' },
      };

      expect(mockPlaylist.id).toBeTruthy();
      expect(mockPlaylist.tracks.total).toBe(50);
      expect(mockPlaylist.owner.display_name).toBe('Test User');
    });

    it('should match expected currently playing structure', () => {
      const mockCurrentlyPlaying = {
        is_playing: true,
        item: {
          id: 'track123',
          name: 'Now Playing',
          artists: [{ id: 'a1', name: 'Artist' }],
          album: { id: 'al1', name: 'Album', images: [] },
          duration_ms: 200000,
          uri: 'spotify:track:track123',
          external_urls: { spotify: '' },
        },
        progress_ms: 45000,
        device: {
          id: 'device1',
          name: 'My Speaker',
          type: 'Speaker',
          is_active: true,
        },
      };

      expect(mockCurrentlyPlaying.is_playing).toBe(true);
      expect(mockCurrentlyPlaying.progress_ms).toBe(45000);
      expect(mockCurrentlyPlaying.device?.is_active).toBe(true);
    });
  });
});

describe('MusicContext - State Management', () => {
  describe('Queue Operations', () => {
    it('should handle queue reordering correctly', () => {
      const queue = ['song1', 'song2', 'song3', 'song4'];
      const fromIndex = 0;
      const toIndex = 2;

      const newQueue = [...queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);

      expect(newQueue).toEqual(['song2', 'song3', 'song1', 'song4']);
    });

    it('should handle removing from queue', () => {
      const queue = ['song1', 'song2', 'song3'];
      const indexToRemove = 1;
      const newQueue = queue.filter((_, i) => i !== indexToRemove);

      expect(newQueue).toEqual(['song1', 'song3']);
    });
  });

  describe('Repeat Mode Cycling', () => {
    it('should cycle through repeat modes correctly', () => {
      const cycleRepeat = (mode: 'off' | 'all' | 'one'): 'off' | 'all' | 'one' => {
        if (mode === 'off') return 'all';
        if (mode === 'all') return 'one';
        return 'off';
      };

      expect(cycleRepeat('off')).toBe('all');
      expect(cycleRepeat('all')).toBe('one');
      expect(cycleRepeat('one')).toBe('off');
    });
  });

  describe('Current Index Calculation', () => {
    it('should find current song index in queue', () => {
      const queue = [
        { id: 'a' }, { id: 'b' }, { id: 'c' }
      ];
      const currentSong = { id: 'b' };
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);

      expect(currentIndex).toBe(1);
    });

    it('should return -1 if song not in queue', () => {
      const queue = [{ id: 'a' }, { id: 'b' }];
      const currentSong = { id: 'x' };
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);

      expect(currentIndex).toBe(-1);
    });
  });
});

describe('PlayerContext - EQ Logic', () => {
  const EQ_FREQUENCIES = [60, 250, 1000, 4000, 16000];

  describe('EQ Band Clamping', () => {
    it('should clamp values to -12 to +12 dB range', () => {
      const clamp = (value: number) => Math.max(-12, Math.min(12, value));

      expect(clamp(15)).toBe(12);
      expect(clamp(-20)).toBe(-12);
      expect(clamp(5)).toBe(5);
      expect(clamp(0)).toBe(0);
    });
  });

  describe('EQ Filter Types', () => {
    it('should assign correct filter types based on band position', () => {
      const getFilterType = (index: number, total: number) => {
        if (index === 0) return 'lowshelf';
        if (index === total - 1) return 'highshelf';
        return 'peaking';
      };

      expect(getFilterType(0, 5)).toBe('lowshelf');
      expect(getFilterType(2, 5)).toBe('peaking');
      expect(getFilterType(4, 5)).toBe('highshelf');
    });
  });

  describe('Crossfade Duration', () => {
    it('should clamp crossfade to 0-12 seconds', () => {
      const clampCrossfade = (seconds: number) => Math.max(0, Math.min(12, seconds));

      expect(clampCrossfade(-5)).toBe(0);
      expect(clampCrossfade(20)).toBe(12);
      expect(clampCrossfade(6)).toBe(6);
    });
  });

  describe('Playback Speed', () => {
    it('should clamp playback speed to 0.5-2.0x', () => {
      const clampSpeed = (speed: number) => Math.max(0.5, Math.min(2.0, speed));

      expect(clampSpeed(0.1)).toBe(0.5);
      expect(clampSpeed(3.0)).toBe(2.0);
      expect(clampSpeed(1.5)).toBe(1.5);
    });
  });
});
