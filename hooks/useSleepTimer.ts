/**
 * useSleepTimer - Hook for managing sleep timer functionality
 * 
 * Encapsulates the interval logic for countdown and auto-pause.
 * Uses settingsStore for state management.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores';

interface UseSleepTimerOptions {
  /** Callback when timer expires - typically pause audio */
  onExpire?: () => void;
}

interface SleepTimerResult {
  /** Whether the timer is currently active */
  isActive: boolean;
  /** Current remaining time in seconds */
  remaining: number;
  /** Original timer duration in minutes, null if not set */
  minutes: number | null;
  /** Start a new sleep timer */
  start: (minutes: number) => void;
  /** Cancel the active timer */
  cancel: () => void;
  /** Format remaining time as MM:SS string */
  formattedRemaining: string;
}

/**
 * Hook for managing sleep timer with automatic countdown and expiry handling
 * 
 * @example
 * ```tsx
 * const { isActive, remaining, start, cancel, formattedRemaining } = useSleepTimer({
 *   onExpire: () => audioRef.current?.pause()
 * });
 * 
 * // Start 30-minute timer
 * start(30);
 * 
 * // Display: "29:45"
 * <span>{formattedRemaining}</span>
 * ```
 */
export function useSleepTimer(options: UseSleepTimerOptions = {}): SleepTimerResult {
  const { onExpire } = options;
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onExpireRef = useRef(onExpire);
  
  // Keep callback ref updated to avoid stale closures
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  
  // Get state from store
  const sleepTimer = useSettingsStore(state => state.sleepTimer);
  const startTimer = useSettingsStore(state => state.startSleepTimer);
  const updateRemaining = useSettingsStore(state => state.updateSleepTimerRemaining);
  const cancelTimer = useSettingsStore(state => state.cancelSleepTimer);
  
  const isActive = sleepTimer.minutes !== null && sleepTimer.remaining > 0;
  
  /**
   * Start a new sleep timer
   */
  const start = useCallback((minutes: number) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Start the timer in store
    startTimer(minutes);
    
    // Calculate end time
    const endTime = Date.now() + minutes * 60 * 1000;
    
    // Start countdown interval
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      updateRemaining(remaining);
      
      if (remaining <= 0) {
        // Timer expired
        onExpireRef.current?.();
        
        // Clean up
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        cancelTimer();
      }
    }, 1000);
  }, [startTimer, updateRemaining, cancelTimer]);
  
  /**
   * Cancel the active timer
   */
  const cancel = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    cancelTimer();
  }, [cancelTimer]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Format remaining time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return {
    isActive,
    remaining: sleepTimer.remaining,
    minutes: sleepTimer.minutes,
    start,
    cancel,
    formattedRemaining: formatTime(sleepTimer.remaining),
  };
}

export default useSleepTimer;
