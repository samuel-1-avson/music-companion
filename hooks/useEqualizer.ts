/**
 * useEqualizer - Hook for 5-band audio equalizer with Web Audio API
 * 
 * Provides:
 * - 5-band EQ (60Hz, 310Hz, 1kHz, 3kHz, 12kHz)
 * - Web Audio API context management
 * - AnalyserNode for visualizer support
 * - Band gain adjustment (-12dB to +12dB)
 */
import { useRef, useCallback, useState } from 'react';
import { useSettingsStore } from '../stores';

// EQ band frequencies and types
const EQ_BANDS = [
  { frequency: 60, type: 'lowshelf' as BiquadFilterType, label: 'Low' },
  { frequency: 310, type: 'peaking' as BiquadFilterType, label: 'Mid-Low' },
  { frequency: 1000, type: 'peaking' as BiquadFilterType, label: 'Mid' },
  { frequency: 3000, type: 'peaking' as BiquadFilterType, label: 'Mid-High' },
  { frequency: 12000, type: 'highshelf' as BiquadFilterType, label: 'High' },
];

interface UseEqualizerResult {
  /** Connect an audio element to the EQ chain */
  connectAudioElement: (audioElement: HTMLAudioElement) => void;
  /** Set individual EQ band gain (index 0-4, value -12 to +12 dB) */
  setEQBand: (index: number, value: number) => void;
  /** Reset all bands to 0dB */
  resetEQ: () => void;
  /** Current EQ values from store */
  eqValues: number[];
  /** AnalyserNode for visualizer, null if not connected */
  analyser: AnalyserNode | null;
  /** Whether an audio element is connected */
  isConnected: boolean;
  /** Band labels and frequencies for UI */
  bands: typeof EQ_BANDS;
}

/**
 * Hook for managing a 5-band equalizer with Web Audio API
 * 
 * @example
 * ```tsx
 * const { connectAudioElement, setEQBand, eqValues, analyser } = useEqualizer();
 * 
 * // Connect when audio element is available
 * useEffect(() => {
 *   if (audioRef.current) {
 *     connectAudioElement(audioRef.current);
 *   }
 * }, [audioRef.current]);
 * 
 * // Adjust bass
 * setEQBand(0, 6); // +6dB at 60Hz
 * ```
 */
export function useEqualizer(): UseEqualizerResult {
  // Refs for Web Audio nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);
  
  // State for analyser (needs to trigger re-renders for visualizer)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Get EQ values from store
  const eqValues = useSettingsStore(state => state.eqValues);
  const storeSetEQBand = useSettingsStore(state => state.setEQBand);
  const storeResetEQ = useSettingsStore(state => state.resetEQ);
  
  /**
   * Connect an audio element to the EQ chain
   */
  const connectAudioElement = useCallback((audioElement: HTMLAudioElement) => {
    // Skip if already connected to this element
    if (sourceRef.current?.mediaElement === audioElement) {
      return;
    }
    
    try {
      // Get or create AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      
      // Resume if suspended (browser autoplay policies)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      // Create EQ filters if not already created
      if (filtersRef.current.length === 0) {
        filtersRef.current = EQ_BANDS.map((band, index) => {
          const filter = ctx.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.value = band.frequency;
          filter.gain.value = eqValues[index] || 0;
          return filter;
        });
      }
      
      // Create analyser for visualizer
      const newAnalyser = ctx.createAnalyser();
      newAnalyser.fftSize = 512;
      
      // Create source from audio element
      const source = ctx.createMediaElementSource(audioElement);
      
      // Chain: source -> filters -> analyser -> destination
      let currentNode: AudioNode = source;
      filtersRef.current.forEach(filter => {
        currentNode.connect(filter);
        currentNode = filter;
      });
      currentNode.connect(newAnalyser);
      newAnalyser.connect(ctx.destination);
      
      // Store references
      sourceRef.current = source;
      connectedElementRef.current = audioElement;
      setAnalyser(newAnalyser);
      setIsConnected(true);
      
      console.log('[useEqualizer] Connected audio element to EQ chain');
    } catch (error) {
      console.warn('[useEqualizer] Web Audio API setup failed:', error);
    }
  }, [eqValues]);
  
  /**
   * Set individual EQ band gain
   */
  const setEQBand = useCallback((index: number, value: number) => {
    // Clamp value to valid range
    const clampedValue = Math.max(-12, Math.min(12, value));
    
    // Update store
    storeSetEQBand(index, clampedValue);
    
    // Update filter if connected
    if (filtersRef.current[index]) {
      filtersRef.current[index].gain.value = clampedValue;
    }
  }, [storeSetEQBand]);
  
  /**
   * Reset all EQ bands to 0dB
   */
  const resetEQ = useCallback(() => {
    // Reset store
    storeResetEQ();
    
    // Reset filters
    filtersRef.current.forEach(filter => {
      filter.gain.value = 0;
    });
  }, [storeResetEQ]);
  
  return {
    connectAudioElement,
    setEQBand,
    resetEQ,
    eqValues,
    analyser,
    isConnected,
    bands: EQ_BANDS,
  };
}

export default useEqualizer;
