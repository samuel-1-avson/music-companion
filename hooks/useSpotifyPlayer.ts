/**
 * useSpotifyPlayer Hook
 * 
 * Manages the Spotify Web Playback SDK to enable in-browser playback.
 * This makes the app appear as a "Spotify Connect" device.
 * 
 * Requirements:
 * - User must have Spotify Premium
 * - User must be authenticated with Spotify
 * - The access token must have the 'streaming' scope
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Extend Window interface for Spotify SDK
declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyPlayerState {
  isReady: boolean;
  isActive: boolean;
  isPaused: boolean;
  deviceId: string | null;
  currentTrack: {
    id: string;
    name: string;
    artists: string[];
    album: string;
    albumArt: string;
    duration: number;
  } | null;
  position: number;
  duration: number;
  volume: number;
  error: string | null;
}

interface UseSpotifyPlayerOptions {
  accessToken: string | null;
  onReady?: (deviceId: string) => void;
  onNotReady?: () => void;
  onPlayerStateChanged?: (state: Spotify.PlaybackState | null) => void;
  onError?: (error: string) => void;
  playerName?: string;
  volume?: number;
}

export function useSpotifyPlayer({
  accessToken,
  onReady,
  onNotReady,
  onPlayerStateChanged,
  onError,
  playerName = 'Music Companion',
  volume: initialVolume = 0.5,
}: UseSpotifyPlayerOptions) {
  const [state, setState] = useState<SpotifyPlayerState>({
    isReady: false,
    isActive: false,
    isPaused: true,
    deviceId: null,
    currentTrack: null,
    position: 0,
    duration: 0,
    volume: initialVolume,
    error: null,
  });

  const playerRef = useRef<Spotify.Player | null>(null);
  const sdkLoadedRef = useRef(false);

  // Load the Spotify SDK script
  const loadSpotifySDK = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (window.Spotify) {
        resolve();
        return;
      }

      if (sdkLoadedRef.current) {
        // Wait for existing load
        const checkInterval = setInterval(() => {
          if (window.Spotify) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        return;
      }

      sdkLoadedRef.current = true;

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;

      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('[SpotifyPlayer] SDK loaded');
        resolve();
      };

      document.body.appendChild(script);
    });
  }, []);

  // Initialize the player
  const initializePlayer = useCallback(async () => {
    if (!accessToken) {
      setState((prev) => ({ ...prev, error: 'No access token' }));
      return;
    }

    await loadSpotifySDK();

    if (playerRef.current) {
      console.log('[SpotifyPlayer] Player already exists');
      return;
    }

    console.log('[SpotifyPlayer] Creating player...');

    const player = new window.Spotify.Player({
      name: playerName,
      getOAuthToken: (cb) => {
        cb(accessToken);
      },
      volume: initialVolume,
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => {
      console.error('[SpotifyPlayer] Initialization error:', message);
      setState((prev) => ({ ...prev, error: message }));
      onError?.(message);
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error('[SpotifyPlayer] Authentication error:', message);
      setState((prev) => ({ ...prev, error: message }));
      onError?.(message);
    });

    player.addListener('account_error', ({ message }) => {
      console.error('[SpotifyPlayer] Account error (Premium required):', message);
      setState((prev) => ({ ...prev, error: 'Spotify Premium required for playback' }));
      onError?.('Spotify Premium required for playback');
    });

    player.addListener('playback_error', ({ message }) => {
      console.error('[SpotifyPlayer] Playback error:', message);
      onError?.(message);
    });

    // Ready/Not Ready
    player.addListener('ready', ({ device_id }) => {
      console.log('[SpotifyPlayer] Ready with device ID:', device_id);
      setState((prev) => ({
        ...prev,
        isReady: true,
        deviceId: device_id,
        error: null,
      }));
      onReady?.(device_id);
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.log('[SpotifyPlayer] Not ready:', device_id);
      setState((prev) => ({
        ...prev,
        isReady: false,
        isActive: false,
      }));
      onNotReady?.();
    });

    // Player state changes
    player.addListener('player_state_changed', (state) => {
      if (!state) {
        setState((prev) => ({
          ...prev,
          isActive: false,
          currentTrack: null,
        }));
        onPlayerStateChanged?.(null);
        return;
      }

      const currentTrack = state.track_window.current_track;
      
      setState((prev) => ({
        ...prev,
        isActive: true,
        isPaused: state.paused,
        position: state.position,
        duration: state.duration,
        currentTrack: currentTrack
          ? {
              id: currentTrack.id,
              name: currentTrack.name,
              artists: currentTrack.artists.map((a) => a.name),
              album: currentTrack.album.name,
              albumArt: currentTrack.album.images[0]?.url || '',
              duration: state.duration,
            }
          : null,
      }));

      onPlayerStateChanged?.(state);
    });

    // Connect
    const connected = await player.connect();
    if (connected) {
      console.log('[SpotifyPlayer] Connected successfully');
      playerRef.current = player;
    } else {
      console.error('[SpotifyPlayer] Failed to connect');
      setState((prev) => ({ ...prev, error: 'Failed to connect to Spotify' }));
    }
  }, [accessToken, loadSpotifySDK, onReady, onNotReady, onPlayerStateChanged, onError, playerName, initialVolume]);

  // Disconnect player on unmount or token change
  useEffect(() => {
    if (accessToken) {
      initializePlayer();
    }

    return () => {
      if (playerRef.current) {
        console.log('[SpotifyPlayer] Disconnecting...');
        playerRef.current.disconnect();
        playerRef.current = null;
        setState((prev) => ({
          ...prev,
          isReady: false,
          isActive: false,
          deviceId: null,
        }));
      }
    };
  }, [accessToken, initializePlayer]);

  // Player control methods
  const togglePlay = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.togglePlay();
    }
  }, []);

  const pause = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.pause();
    }
  }, []);

  const resume = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.resume();
    }
  }, []);

  const nextTrack = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.nextTrack();
    }
  }, []);

  const previousTrack = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.previousTrack();
    }
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    if (playerRef.current) {
      await playerRef.current.seek(positionMs);
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    if (playerRef.current) {
      await playerRef.current.setVolume(volume);
      setState((prev) => ({ ...prev, volume }));
    }
  }, []);

  const getState = useCallback(async (): Promise<Spotify.PlaybackState | null> => {
    if (playerRef.current) {
      return playerRef.current.getCurrentState();
    }
    return null;
  }, []);

  // Transfer playback to this device
  const transferPlayback = useCallback(async (play: boolean = false) => {
    if (!state.deviceId || !accessToken) return false;

    try {
      await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [state.deviceId],
          play,
        }),
      });
      return true;
    } catch (error) {
      console.error('[SpotifyPlayer] Transfer playback error:', error);
      return false;
    }
  }, [state.deviceId, accessToken]);

  return {
    ...state,
    player: playerRef.current,
    togglePlay,
    pause,
    resume,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    getState,
    transferPlayback,
  };
}

export default useSpotifyPlayer;
