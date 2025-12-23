import { useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

interface CrossfadeOptions {
  onSongEnd?: () => void;
}

/**
 * Hook for managing crossfade between audio elements
 * Provides smooth audio transitions between tracks
 */
export function useCrossfade(options: CrossfadeOptions = {}) {
  const crossfadeDuration = useSettingsStore(state => state.crossfadeDuration);
  
  const primaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCrossfadingRef = useRef(false);

  /**
   * Initialize crossfade by preparing the next track
   */
  const prepareNextTrack = useCallback((nextUrl: string) => {
    if (!secondaryAudioRef.current) {
      secondaryAudioRef.current = new Audio();
      secondaryAudioRef.current.crossOrigin = 'anonymous';
    }
    
    secondaryAudioRef.current.src = nextUrl;
    secondaryAudioRef.current.volume = 0;
    secondaryAudioRef.current.load();
    
    console.log('[Crossfade] Prepared next track');
  }, []);

  /**
   * Start crossfade transition
   */
  const startCrossfade = useCallback(() => {
    if (isCrossfadingRef.current || crossfadeDuration === 0) return;
    if (!primaryAudioRef.current || !secondaryAudioRef.current) return;
    
    isCrossfadingRef.current = true;
    const duration = crossfadeDuration * 1000; // Convert to ms
    const steps = 50; // Number of volume steps
    const interval = duration / steps;
    let step = 0;
    
    // Start playing secondary audio
    secondaryAudioRef.current.play().catch(console.warn);
    
    console.log(`[Crossfade] Starting ${crossfadeDuration}s crossfade`);
    
    crossfadeIntervalRef.current = setInterval(() => {
      step++;
      const progress = step / steps;
      
      if (primaryAudioRef.current) {
        primaryAudioRef.current.volume = Math.max(0, 1 - progress);
      }
      if (secondaryAudioRef.current) {
        secondaryAudioRef.current.volume = Math.min(1, progress);
      }
      
      if (step >= steps) {
        // Crossfade complete
        clearInterval(crossfadeIntervalRef.current!);
        crossfadeIntervalRef.current = null;
        isCrossfadingRef.current = false;
        
        // Swap references
        if (primaryAudioRef.current) {
          primaryAudioRef.current.pause();
          primaryAudioRef.current.src = '';
        }
        
        // Swap primary and secondary
        const temp = primaryAudioRef.current;
        primaryAudioRef.current = secondaryAudioRef.current;
        secondaryAudioRef.current = temp;
        
        console.log('[Crossfade] Complete');
        options.onSongEnd?.();
      }
    }, interval);
  }, [crossfadeDuration, options]);

  /**
   * Cancel ongoing crossfade
   */
  const cancelCrossfade = useCallback(() => {
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }
    isCrossfadingRef.current = false;
    
    // Reset volumes
    if (primaryAudioRef.current) primaryAudioRef.current.volume = 1;
    if (secondaryAudioRef.current) {
      secondaryAudioRef.current.pause();
      secondaryAudioRef.current.volume = 0;
    }
  }, []);

  /**
   * Check if we should start crossfade based on time remaining
   */
  const checkCrossfadeTrigger = useCallback((currentTime: number, duration: number) => {
    if (isCrossfadingRef.current || crossfadeDuration === 0) return false;
    
    const timeRemaining = duration - currentTime;
    const shouldTrigger = timeRemaining <= crossfadeDuration && timeRemaining > 0;
    
    if (shouldTrigger && secondaryAudioRef.current?.src) {
      startCrossfade();
      return true;
    }
    return false;
  }, [crossfadeDuration, startCrossfade]);

  return {
    primaryAudioRef,
    secondaryAudioRef,
    prepareNextTrack,
    startCrossfade,
    cancelCrossfade,
    checkCrossfadeTrigger,
    isCrossfading: isCrossfadingRef.current,
    crossfadeDuration,
  };
}
