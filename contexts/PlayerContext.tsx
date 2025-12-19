/**
 * PlayerContext - Audio engine and visualization state
 * 
 * Manages the actual audio playback engine:
 * - Audio context and analyser for visualizations
 * - EQ filters
 * - Crossfade between tracks
 * - Audio element refs
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';

// EQ band frequencies
const EQ_FREQUENCIES = [60, 250, 1000, 4000, 16000]; // Hz for Low, MidLow, Mid, MidHigh, High

// Player state interface
interface PlayerState {
  musicAnalyser: AnalyserNode | null;
  eqValues: number[]; // -12 to +12 dB for each band
  crossfadeDuration: number; // 0-12 seconds
  playbackSpeed: number; // 0.5 to 2.0
  isAudioReady: boolean;
}

// Context type
interface PlayerContextType extends PlayerState {
  // Audio refs
  audioRef: React.RefObject<HTMLAudioElement>;
  
  // Initialization
  initializeAudioContext: (audioElement: HTMLAudioElement) => void;
  
  // EQ controls
  setEqBand: (bandIndex: number, value: number) => void;
  setEqValues: (values: number[]) => void;
  resetEq: () => void;
  
  // Crossfade
  setCrossfadeDuration: (seconds: number) => void;
  
  // Playback speed
  setPlaybackSpeed: (speed: number) => void;
  
  // Get audio data for visualizations
  getAudioData: () => Uint8Array | null;
  getFrequencyData: () => Uint8Array | null;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

// Hook to access player context
export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
};

// Provider props
interface PlayerProviderProps {
  children: ReactNode;
}

export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
  // State
  const [musicAnalyser, setMusicAnalyser] = useState<AnalyserNode | null>(null);
  const [eqValues, setEqValues] = useState<number[]>([0, 0, 0, 0, 0]);
  const [crossfadeDuration, setCrossfadeDuration] = useState(3);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  /**
   * Initialize Web Audio API for visualization and EQ
   */
  const initializeAudioContext = useCallback((audioElement: HTMLAudioElement) => {
    // Only initialize once
    if (audioContextRef.current && sourceNodeRef.current) {
      console.log('[Player] Audio context already initialized');
      return;
    }

    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create source from audio element
      const source = audioContext.createMediaElementSource(audioElement);
      sourceNodeRef.current = source;

      // Create analyser for visualizations
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      setMusicAnalyser(analyser);

      // Create EQ filters
      const filters = EQ_FREQUENCIES.map((freq, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = index === 0 ? 'lowshelf' : 
                      index === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.gain.value = 0;
        if (filter.type === 'peaking') {
          filter.Q.value = 1.0;
        }
        return filter;
      });
      eqFiltersRef.current = filters;

      // Create gain node for overall volume
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      gainNodeRef.current = gainNode;

      // Connect: source -> EQ filters -> analyser -> gain -> destination
      let currentNode: AudioNode = source;
      filters.forEach(filter => {
        currentNode.connect(filter);
        currentNode = filter;
      });
      currentNode.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);

      setIsAudioReady(true);
      console.log('[Player] Audio context initialized with EQ and analyser');
    } catch (error) {
      console.error('[Player] Failed to initialize audio context:', error);
    }
  }, []);

  /**
   * Set individual EQ band
   */
  const setEqBand = useCallback((bandIndex: number, value: number) => {
    if (bandIndex < 0 || bandIndex >= eqFiltersRef.current.length) return;
    
    // Clamp value to -12 to +12 dB
    const clampedValue = Math.max(-12, Math.min(12, value));
    
    // Update filter
    const filter = eqFiltersRef.current[bandIndex];
    if (filter) {
      filter.gain.value = clampedValue;
    }
    
    // Update state
    setEqValues(prev => {
      const newValues = [...prev];
      newValues[bandIndex] = clampedValue;
      return newValues;
    });
  }, []);

  /**
   * Set all EQ values at once
   */
  const setAllEqValues = useCallback((values: number[]) => {
    values.forEach((value, index) => {
      if (index < eqFiltersRef.current.length) {
        const clampedValue = Math.max(-12, Math.min(12, value));
        const filter = eqFiltersRef.current[index];
        if (filter) {
          filter.gain.value = clampedValue;
        }
      }
    });
    setEqValues(values.slice(0, 5));
  }, []);

  /**
   * Reset EQ to flat
   */
  const resetEq = useCallback(() => {
    eqFiltersRef.current.forEach(filter => {
      filter.gain.value = 0;
    });
    setEqValues([0, 0, 0, 0, 0]);
  }, []);

  /**
   * Get time-domain audio data for waveform visualization
   */
  const getAudioData = useCallback((): Uint8Array | null => {
    if (!musicAnalyser) return null;
    const dataArray = new Uint8Array(musicAnalyser.fftSize);
    musicAnalyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }, [musicAnalyser]);

  /**
   * Get frequency data for spectrum visualization
   */
  const getFrequencyData = useCallback((): Uint8Array | null => {
    if (!musicAnalyser) return null;
    const dataArray = new Uint8Array(musicAnalyser.frequencyBinCount);
    musicAnalyser.getByteFrequencyData(dataArray);
    return dataArray;
  }, [musicAnalyser]);

  /**
   * Handle playback speed changes
   */
  const handleSetPlaybackSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    setPlaybackSpeed(clampedSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = clampedSpeed;
    }
  }, []);

  /**
   * Handle crossfade duration changes
   */
  const handleSetCrossfadeDuration = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(12, seconds));
    setCrossfadeDuration(clamped);
    localStorage.setItem('crossfade_duration', String(clamped));
  }, []);

  // Load saved settings on mount
  useEffect(() => {
    const savedCrossfade = localStorage.getItem('crossfade_duration');
    if (savedCrossfade !== null) {
      setCrossfadeDuration(Number(savedCrossfade));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const value: PlayerContextType = {
    // State
    musicAnalyser,
    eqValues,
    crossfadeDuration,
    playbackSpeed,
    isAudioReady,
    
    // Refs
    audioRef,
    
    // Initialization
    initializeAudioContext,
    
    // EQ controls
    setEqBand,
    setEqValues: setAllEqValues,
    resetEq,
    
    // Crossfade
    setCrossfadeDuration: handleSetCrossfadeDuration,
    
    // Playback speed
    setPlaybackSpeed: handleSetPlaybackSpeed,
    
    // Visualization data
    getAudioData,
    getFrequencyData,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerProvider;
