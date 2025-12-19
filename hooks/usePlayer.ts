import { useState, useRef, useCallback, useEffect } from 'react';
import { Song } from '../types';

interface UsePlayerOptions {
  crossfadeDuration?: number;
  onSongEnd?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

interface UsePlayerReturn {
  // State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isLoading: boolean;
  error: string | null;
  
  // Refs
  audioRef: React.RefObject<HTMLAudioElement>;
  
  // Actions
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  loadSong: (url: string) => Promise<void>;
}

export const usePlayer = (options: UsePlayerOptions = {}): UsePlayerReturn => {
  const { crossfadeDuration = 0, onSongEnd, onTimeUpdate } = options;
  
  // Audio element ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Play
  const play = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setError(null);
    } catch (e) {
      setError('Failed to play audio');
      console.error('[usePlayer] Play error:', e);
    }
  }, []);

  // Pause
  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  // Toggle
  const toggle = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  // Seek
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  // Volume
  const setVolume = useCallback((vol: number) => {
    if (!audioRef.current) return;
    const clampedVol = Math.max(0, Math.min(1, vol));
    audioRef.current.volume = clampedVol;
    setVolumeState(clampedVol);
    if (clampedVol > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  // Load song
  const loadSong = useCallback(async (url: string) => {
    if (!audioRef.current) return;
    setIsLoading(true);
    setError(null);
    
    try {
      audioRef.current.src = url;
      audioRef.current.load();
    } catch (e) {
      setError('Failed to load audio');
      console.error('[usePlayer] Load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onSongEnd?.();
    };

    const handleError = () => {
      setError('Audio playback error');
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onSongEnd, onTimeUpdate]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isLoading,
    error,
    audioRef,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    loadSong,
  };
};

export default usePlayer;
