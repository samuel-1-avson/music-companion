/**
 * Audio Store - Zustand state management for audio playback state
 * 
 * Manages:
 * - Playback time and duration
 * - Audio loading/buffering states
 * - Crossfade state
 * - Visualizer data reference
 */
import { create } from 'zustand';

interface AudioState {
  // Playback Progress
  currentTime: number;
  duration: number;
  bufferedProgress: number; // 0-1 representing how much is buffered
  
  // Loading States
  isLoading: boolean;
  isBuffering: boolean;
  
  // Crossfade
  isCrossfading: boolean;
  crossfadeProgress: number; // 0-1
  
  // Audio Context State
  isAudioContextReady: boolean;
  
  // Actions
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setBufferedProgress: (progress: number) => void;
  setIsLoading: (loading: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setCrossfadeState: (crossfading: boolean, progress?: number) => void;
  setAudioContextReady: (ready: boolean) => void;
  
  // Computed helpers
  getProgress: () => number; // 0-1 playback progress
  getFormattedCurrentTime: () => string;
  getFormattedDuration: () => string;
  
  // Reset
  reset: () => void;
}

/**
 * Format seconds to MM:SS string
 */
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const useAudioStore = create<AudioState>()((set, get) => ({
  // Initial State
  currentTime: 0,
  duration: 0,
  bufferedProgress: 0,
  isLoading: false,
  isBuffering: false,
  isCrossfading: false,
  crossfadeProgress: 0,
  isAudioContextReady: false,
  
  // Actions
  setCurrentTime: (time) => set({ currentTime: time }),
  
  setDuration: (duration) => set({ duration: Math.max(0, duration) }),
  
  setBufferedProgress: (progress) => set({ 
    bufferedProgress: Math.max(0, Math.min(1, progress)) 
  }),
  
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),
  
  setCrossfadeState: (crossfading, progress = 0) => set({ 
    isCrossfading: crossfading,
    crossfadeProgress: progress
  }),
  
  setAudioContextReady: (ready) => set({ isAudioContextReady: ready }),
  
  // Computed helpers
  getProgress: () => {
    const { currentTime, duration } = get();
    if (!duration) return 0;
    return Math.max(0, Math.min(1, currentTime / duration));
  },
  
  getFormattedCurrentTime: () => formatTime(get().currentTime),
  
  getFormattedDuration: () => formatTime(get().duration),
  
  // Reset
  reset: () => set({
    currentTime: 0,
    duration: 0,
    bufferedProgress: 0,
    isLoading: false,
    isBuffering: false,
    isCrossfading: false,
    crossfadeProgress: 0,
  }),
}));
