/**
 * Player Store - Zustand state management for audio playback
 * Replaces useState hooks in App.tsx for player-related state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, MusicProvider } from '../types';

interface PlayerState {
  // Playback State
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  
  // Playback Modes
  shuffleEnabled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  
  // Smart DJ
  smartDJEnabled: boolean;
  isSmartDJLoading: boolean;
  
  // Radio Mode
  isRadioMode: boolean;
  isDJSpeaking: boolean;
  
  // Provider
  musicProvider: MusicProvider;
  
  // Actions
  setCurrentSong: (song: Song | null) => void;
  playSong: (song: Song, contextQueue?: Song[]) => void;
  setQueue: (queue: Song[] | ((prev: Song[]) => Song[])) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (songId: string) => void;
  clearQueue: () => void;
  
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number | ((prev: number) => number)) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: number) => void;
  
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  
  setSmartDJEnabled: (enabled: boolean) => void;
  setIsSmartDJLoading: (loading: boolean) => void;
  
  setIsRadioMode: (enabled: boolean) => void;
  setIsDJSpeaking: (speaking: boolean) => void;
  
  setMusicProvider: (provider: MusicProvider) => void;
  
  // Queue Navigation
  getNextSong: () => Song | null;
  getPrevSong: () => Song | null;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentSong: null,
      queue: [],
      isPlaying: false,
      volume: 0.75,
      isMuted: false,
      playbackSpeed: 1.0,
      shuffleEnabled: false,
      repeatMode: 'off',
      smartDJEnabled: false,
      isSmartDJLoading: false,
      isRadioMode: false,
      isDJSpeaking: false,
      musicProvider: 'YOUTUBE',
      
      // Actions
      setCurrentSong: (song) => set({ currentSong: song }),
      
      playSong: (song, contextQueue) => {
        if (contextQueue) {
          set({ currentSong: song, queue: contextQueue, isPlaying: true });
        } else {
          const { queue } = get();
          // Add to queue if not already present
          const exists = queue.some(s => s.id === song.id);
          if (!exists) {
            set({ currentSong: song, queue: [...queue, song], isPlaying: true });
          } else {
            set({ currentSong: song, isPlaying: true });
          }
        }
      },
      
      setQueue: (queueOrUpdater) => {
        if (typeof queueOrUpdater === 'function') {
          set(state => ({ queue: queueOrUpdater(state.queue) }));
        } else {
          set({ queue: queueOrUpdater });
        }
      },
      
      addToQueue: (song) => set(state => ({
        queue: [...state.queue, song]
      })),
      
      removeFromQueue: (songId) => set(state => ({
        queue: state.queue.filter(s => s.id !== songId)
      })),
      
      clearQueue: () => set({ queue: [], currentSong: null }),
      
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      
      setVolume: (volumeOrUpdater) => {
        if (typeof volumeOrUpdater === 'function') {
          set(state => ({ volume: Math.max(0, Math.min(1, volumeOrUpdater(state.volume))) }));
        } else {
          set({ volume: Math.max(0, Math.min(1, volumeOrUpdater)) });
        }
      },
      
      toggleMute: () => set(state => ({ isMuted: !state.isMuted })),
      
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      
      toggleShuffle: () => set(state => ({ shuffleEnabled: !state.shuffleEnabled })),
      
      cycleRepeatMode: () => set(state => ({
        repeatMode: state.repeatMode === 'off' ? 'all' : 
                    state.repeatMode === 'all' ? 'one' : 'off'
      })),
      
      setSmartDJEnabled: (enabled) => set({ smartDJEnabled: enabled }),
      setIsSmartDJLoading: (loading) => set({ isSmartDJLoading: loading }),
      
      setIsRadioMode: (enabled) => set({ isRadioMode: enabled }),
      setIsDJSpeaking: (speaking) => set({ isDJSpeaking: speaking }),
      
      setMusicProvider: (provider) => set({ musicProvider: provider }),
      
      // Queue Navigation
      getNextSong: () => {
        const { queue, currentSong, shuffleEnabled, repeatMode } = get();
        if (!currentSong || queue.length === 0) return null;
        
        const currentIdx = queue.findIndex(s => s.id === currentSong.id);
        
        if (repeatMode === 'one') {
          return currentSong;
        }
        
        if (shuffleEnabled) {
          const availableSongs = queue.filter(s => s.id !== currentSong.id);
          if (availableSongs.length === 0) return repeatMode === 'all' ? currentSong : null;
          return availableSongs[Math.floor(Math.random() * availableSongs.length)];
        }
        
        if (currentIdx < queue.length - 1) {
          return queue[currentIdx + 1];
        }
        
        return repeatMode === 'all' ? queue[0] : null;
      },
      
      getPrevSong: () => {
        const { queue, currentSong } = get();
        if (!currentSong || queue.length === 0) return null;
        
        const currentIdx = queue.findIndex(s => s.id === currentSong.id);
        if (currentIdx > 0) {
          return queue[currentIdx - 1];
        }
        return queue[queue.length - 1]; // Loop to end
      }
    }),
    {
      name: 'player-storage',
      partialize: (state) => ({
        volume: state.volume,
        shuffleEnabled: state.shuffleEnabled,
        repeatMode: state.repeatMode,
        playbackSpeed: state.playbackSpeed,
        musicProvider: state.musicProvider,
        smartDJEnabled: state.smartDJEnabled
      })
    }
  )
);
