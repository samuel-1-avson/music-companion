/**
 * MusicContext - Centralized music playback state
 * 
 * Extracted from App.tsx to provide global access to:
 * - Current song and queue
 * - Spotify integration state
 * - Music provider selection
 * - Playback controls
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { Song, MusicProvider as MusicProviderType, SpotifyProfile } from '../types';
import { getYouTubeAudioStream } from '../services/musicService';
import { addToHistoryDB } from '../utils/db';

// Music state interface
interface MusicState {
  currentSong: Song | null;
  queue: Song[];
  musicProvider: MusicProviderType;
  spotifyToken: string | null;
  spotifyProfile: SpotifyProfile | null;
  isRadioMode: boolean;
  shuffleEnabled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
}

// Context type with state and actions
interface MusicContextType extends MusicState {
  // Song controls
  playSong: (song: Song, newQueue?: Song[]) => void;
  playNext: () => void;
  playPrev: () => void;
  
  // Queue controls
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  
  // Playback controls
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  toggleRadioMode: () => void;
  
  // Provider controls
  setMusicProvider: (provider: MusicProviderType) => void;
  setSpotifyToken: (token: string | null) => void;
  setSpotifyProfile: (profile: SpotifyProfile | null) => void;
  disconnectSpotify: () => void;
  
  // Helpers
  hasNext: boolean;
  hasPrev: boolean;
  currentIndex: number;
}

const MusicContext = createContext<MusicContextType | null>(null);

// Hook to access music context
export const useMusic = (): MusicContextType => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
};

// Provider props
interface MusicProviderProps {
  children: ReactNode;
}

export const MusicProvider: React.FC<MusicProviderProps> = ({ children }) => {
  // Core playback state
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
  
  // Playback modes
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isRadioMode, setIsRadioMode] = useState(false);
  
  // Provider state
  const [musicProvider, setMusicProvider] = useState<MusicProviderType>('YOUTUBE');
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyProfile | null>(null);
  
  // Refs for history tracking
  const historyRef = useRef<string[]>([]);

  // Calculate current index
  const currentIndex = currentSong ? queue.findIndex(s => s.id === currentSong.id) : -1;
  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;

  /**
   * Play a song, optionally replacing the queue
   */
  const playSong = useCallback(async (song: Song, newQueue?: Song[]) => {
    console.log('[Music] Playing:', song.title);
    
    // Update queue if provided
    if (newQueue) {
      setQueue(newQueue);
    } else if (!queue.find(s => s.id === song.id)) {
      // Add to queue if not already there
      setQueue(prev => [...prev, song]);
    }
    
    // Fetch stream URL if needed
    let songToPlay = song;
    
    // If song already has a playable URL (previewUrl or fileBlob), use it
    if (!song.previewUrl && !song.fileBlob) {
      // For YouTube videos, get the audio stream
      if (musicProvider === 'YOUTUBE' && song.id) {
        try {
          console.log('[Music] Fetching YouTube stream for:', song.id);
          const streamUrl = await getYouTubeAudioStream(song.id);
          if (streamUrl) {
            songToPlay = { ...song, previewUrl: streamUrl };
            console.log('[Music] Got YouTube stream URL');
          } else {
            console.warn('[Music] No stream URL returned for YouTube video');
          }
        } catch (error) {
          console.error('[Music] Failed to get YouTube stream:', error);
        }
      }
      // For Spotify tracks without preview, try to find on YouTube by title+artist
      else if (musicProvider === 'SPOTIFY' && song.title && song.artist) {
        try {
          console.log('[Music] Spotify track without preview, searching YouTube for:', song.title, song.artist);
          // Import searchMusic dynamically to avoid circular dep
          const { searchMusic } = await import('../services/musicService');
          const results = await searchMusic(`${song.title} ${song.artist}`);
          if (results.length > 0 && results[0].videoId) {
            const streamUrl = await getYouTubeAudioStream(results[0].videoId);
            if (streamUrl) {
              songToPlay = { ...song, previewUrl: streamUrl };
              console.log('[Music] Got YouTube fallback stream for Spotify track');
            }
          }
        } catch (error) {
          console.error('[Music] Failed to get YouTube fallback for Spotify track:', error);
        }
      }
    }
    
    setCurrentSong(songToPlay);
    setIsPlaying(true);
    
    // Add to history
    historyRef.current.unshift(song.id);
    if (historyRef.current.length > 50) {
      historyRef.current = historyRef.current.slice(0, 50);
    }
    
    // Add to database history
    addToHistoryDB({
      id: song.id,
      title: song.title,
      artist: song.artist,
      coverUrl: song.coverUrl,
      timestamp: Date.now(),
    });
  }, [queue, musicProvider]);

  /**
   * Play next song in queue
   */
  const playNext = useCallback(() => {
    if (!currentSong || queue.length === 0) return;
    
    // Handle repeat one
    if (repeatMode === 'one') {
      playSong(currentSong);
      return;
    }
    
    // Handle shuffle
    if (shuffleEnabled) {
      const unplayedSongs = queue.filter(s => !historyRef.current.includes(s.id));
      if (unplayedSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * unplayedSongs.length);
        playSong(unplayedSongs[randomIndex]);
        return;
      }
    }
    
    // Normal next
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playSong(queue[nextIndex]);
    } else if (repeatMode === 'all' && queue.length > 0) {
      playSong(queue[0]);
    }
  }, [currentSong, queue, currentIndex, repeatMode, shuffleEnabled, playSong]);

  /**
   * Play previous song in queue
   */
  const playPrev = useCallback(() => {
    if (!currentSong || currentIndex <= 0) return;
    playSong(queue[currentIndex - 1]);
  }, [currentSong, currentIndex, queue, playSong]);

  /**
   * Queue management
   */
  const addToQueue = useCallback((song: Song) => {
    setQueue(prev => [...prev, song]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return newQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
  }, []);

  /**
   * Playback controls
   */
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleEnabled(prev => !prev);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const toggleRadioMode = useCallback(() => {
    setIsRadioMode(prev => !prev);
  }, []);

  /**
   * Spotify controls
   */
  const disconnectSpotify = useCallback(() => {
    setSpotifyToken(null);
    setSpotifyProfile(null);
    localStorage.removeItem('spotify_token');
    if (musicProvider === 'SPOTIFY') {
      setMusicProvider('YOUTUBE');
    }
  }, [musicProvider]);

  const value: MusicContextType = {
    // State
    currentSong,
    queue,
    musicProvider,
    spotifyToken,
    spotifyProfile,
    isRadioMode,
    shuffleEnabled,
    repeatMode,
    volume,
    isMuted,
    isPlaying,
    
    // Song controls
    playSong,
    playNext,
    playPrev,
    
    // Queue controls
    addToQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    
    // Playback controls
    setIsPlaying,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    toggleRadioMode,
    
    // Provider controls
    setMusicProvider,
    setSpotifyToken,
    setSpotifyProfile,
    disconnectSpotify,
    
    // Helpers
    hasNext,
    hasPrev,
    currentIndex,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};

export default MusicProvider;
