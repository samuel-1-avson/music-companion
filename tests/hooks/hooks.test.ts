import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Import hooks
import { useQueue } from '../../hooks/useQueue';
import { useTheme } from '../../hooks/useTheme';

describe('useQueue Hook', () => {
  const mockSongs = [
    { id: '1', title: 'Song 1', artist: 'Artist 1' },
    { id: '2', title: 'Song 2', artist: 'Artist 2' },
    { id: '3', title: 'Song 3', artist: 'Artist 3' },
  ] as any[];

  describe('initialization', () => {
    it('should initialize with empty queue', () => {
      const { result } = renderHook(() => useQueue());
      
      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.currentSong).toBeNull();
    });

    it('should initialize with provided queue', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      expect(result.current.queue).toHaveLength(3);
      expect(result.current.currentSong).toEqual(mockSongs[0]);
    });
  });

  describe('navigation', () => {
    it('should navigate to next song', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      act(() => {
        result.current.next();
      });
      
      expect(result.current.currentIndex).toBe(1);
      expect(result.current.currentSong).toEqual(mockSongs[1]);
    });

    it('should navigate to previous song', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      // First go to next
      act(() => {
        result.current.next();
      });
      
      expect(result.current.currentIndex).toBe(1);
      
      // Then go back
      act(() => {
        result.current.previous();
      });
      
      expect(result.current.currentIndex).toBe(0);
    });

    it('should not go past queue end', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      act(() => {
        result.current.next();
      });
      act(() => {
        result.current.next();
      });
      act(() => {
        result.current.next(); // Try to go past end
      });
      
      expect(result.current.currentIndex).toBe(2);
    });

    it('should jump to specific index', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      act(() => {
        result.current.goTo(2);
      });
      
      expect(result.current.currentIndex).toBe(2);
    });
  });

  describe('queue management', () => {
    it('should add song to queue', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      const newSong = { id: '4', title: 'Song 4', artist: 'Artist 4' } as any;
      
      act(() => {
        result.current.addToQueue(newSong);
      });
      
      expect(result.current.queue).toHaveLength(4);
    });

    it('should add multiple songs', () => {
      const { result } = renderHook(() => useQueue([]));
      
      act(() => {
        result.current.addMultiple(mockSongs);
      });
      
      expect(result.current.queue).toHaveLength(3);
    });

    it('should clear queue', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      act(() => {
        result.current.clearQueue();
      });
      
      expect(result.current.queue).toHaveLength(0);
      expect(result.current.currentIndex).toBe(0);
    });

    it('should shuffle queue', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      act(() => {
        result.current.shuffle();
      });
      
      // Current song should be at index 0 after shuffle
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.queue).toHaveLength(3);
    });
  });

  describe('state tracking', () => {
    it('should track hasNext correctly', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      expect(result.current.hasNext).toBe(true);
      
      act(() => {
        result.current.goTo(2);
      });
      
      expect(result.current.hasNext).toBe(false);
    });

    it('should track hasPrevious correctly', () => {
      const { result } = renderHook(() => useQueue(mockSongs));
      
      expect(result.current.hasPrevious).toBe(false);
      
      act(() => {
        result.current.next();
      });
      
      expect(result.current.hasPrevious).toBe(true);
    });
  });
});

describe('useTheme Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with default theme', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe('minimal');
  });

  it('should set theme', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('glass');
    });
    
    expect(result.current.theme).toBe('glass');
  });

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('retro');
    });
    
    expect(localStorage.getItem('theme')).toBe('retro');
  });

  it('should cycle themes', () => {
    const { result } = renderHook(() => useTheme());
    const initialTheme = result.current.theme;
    
    act(() => {
      result.current.cycleTheme();
    });
    
    expect(result.current.theme).not.toBe(initialTheme);
  });

  it('should provide list of themes', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.themes.length).toBeGreaterThan(0);
    expect(result.current.themes).toContain('minimal');
    expect(result.current.themes).toContain('glass');
  });
});
