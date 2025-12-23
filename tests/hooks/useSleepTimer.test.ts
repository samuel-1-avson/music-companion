import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useSettingsStore } from '../../stores';

// Mock timers
vi.useFakeTimers();

describe('useSleepTimer', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSettingsStore.getState().cancelSleepTimer();
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('Initial State', () => {
    it('should start inactive with no remaining time', () => {
      const { result } = renderHook(() => useSleepTimer());

      expect(result.current.isActive).toBe(false);
      expect(result.current.remaining).toBe(0);
      expect(result.current.minutes).toBeNull();
      expect(result.current.formattedRemaining).toBe('0:00');
    });
  });

  describe('Starting Timer', () => {
    it('should activate timer when started', () => {
      const { result } = renderHook(() => useSleepTimer());

      act(() => {
        result.current.start(5); // 5 minutes
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.minutes).toBe(5);
      expect(result.current.remaining).toBe(300); // 5 * 60 seconds
    });

    it('should format remaining time correctly', () => {
      const { result } = renderHook(() => useSleepTimer());

      act(() => {
        result.current.start(10); // 10 minutes
      });

      expect(result.current.formattedRemaining).toBe('10:00');

      // Advance 90 seconds
      act(() => {
        vi.advanceTimersByTime(90000);
      });

      // Should be 8:30 (510 seconds - 90 = 510 remaining, but we started at 600)
      // After 90 seconds: 600 - 90 = 510 seconds = 8 minutes 30 seconds
      expect(result.current.formattedRemaining).toBe('8:30');
    });

    it('should restart timer when called again', () => {
      const { result } = renderHook(() => useSleepTimer());

      act(() => {
        result.current.start(10);
      });

      // Advance 60 seconds
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(result.current.remaining).toBe(540); // 9 minutes

      // Restart with new timer
      act(() => {
        result.current.start(5);
      });

      expect(result.current.remaining).toBe(300); // Reset to 5 minutes
      expect(result.current.minutes).toBe(5);
    });
  });

  describe('Cancelling Timer', () => {
    it('should deactivate timer when cancelled', () => {
      const { result } = renderHook(() => useSleepTimer());

      act(() => {
        result.current.start(5);
      });

      expect(result.current.isActive).toBe(true);

      act(() => {
        result.current.cancel();
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.remaining).toBe(0);
      expect(result.current.minutes).toBeNull();
    });
  });

  describe('Timer Expiry', () => {
    it('should call onExpire callback when timer reaches zero', () => {
      const onExpire = vi.fn();
      const { result } = renderHook(() => useSleepTimer({ onExpire }));

      act(() => {
        result.current.start(1); // 1 minute
      });

      expect(onExpire).not.toHaveBeenCalled();

      // Advance past the timer duration (60 seconds + a bit more)
      act(() => {
        vi.advanceTimersByTime(61000);
      });

      expect(onExpire).toHaveBeenCalledTimes(1);
      expect(result.current.isActive).toBe(false);
    });

    it('should auto-cancel after expiry', () => {
      const { result } = renderHook(() => useSleepTimer());

      act(() => {
        result.current.start(1);
      });

      // Advance past timer
      act(() => {
        vi.advanceTimersByTime(65000);
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.minutes).toBeNull();
    });
  });

  describe('Countdown', () => {
    it('should count down every second', () => {
      const { result } = renderHook(() => useSleepTimer());

      act(() => {
        result.current.start(1); // 1 minute = 60 seconds
      });

      expect(result.current.remaining).toBe(60);

      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.remaining).toBe(59);

      // Advance 10 more seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.remaining).toBe(49);
    });
  });
});
