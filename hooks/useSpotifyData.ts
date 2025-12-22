/**
 * useSpotifyData Hook
 * 
 * Fetches user's Spotify data using OAuth tokens from AuthContext.
 * Provides access to recently played, top tracks, playlists, and currently playing.
 * 
 * NOTE: Supabase OAuth does NOT refresh Spotify provider tokens. They expire after 1 hour.
 * Users must re-authenticate with Spotify when the token expires.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';


// Types for Spotify API responses
export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  uri: string;
  external_urls: { spotify: string };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  followers: { total: number };
  external_urls: { spotify: string };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  owner: { id: string; display_name: string };
  tracks: { total: number };
  public: boolean;
  external_urls: { spotify: string };
}

export interface RecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
}

export interface CurrentlyPlaying {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms: number;
  device?: {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
  };
}

export interface SpotifyDataState {
  recentlyPlayed: RecentlyPlayedItem[];
  topTracks: SpotifyTrack[];
  topArtists: SpotifyArtist[];
  playlists: SpotifyPlaylist[];
  currentlyPlaying: CurrentlyPlaying | null;
  isLoading: boolean;
  error: string | null;
  tokenExpiresAt: number | null;
}

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

import api from '../utils/apiClient';

export function useSpotifyData() {
  const { spotifyTokens, hasSpotifyAccess, refreshSpotifyToken, user, isAuthenticated } = useAuth();
  
  // Local token state - can come from AuthContext OR backend
  const [localToken, setLocalToken] = useState<{ accessToken: string; expiresAt: number | null } | null>(null);
  
  const [state, setState] = useState<SpotifyDataState>({
    recentlyPlayed: [],
    topTracks: [],
    topArtists: [],
    playlists: [],
    currentlyPlaying: null,
    isLoading: false,
    error: null,
    tokenExpiresAt: null,
  });

  // Fetch token from backend if not available from AuthContext
  useEffect(() => {
    const fetchBackendToken = async () => {
      if (!isAuthenticated || !user?.id) return;
      
      // If AuthContext has tokens, use those
      if (spotifyTokens?.accessToken) {
        setLocalToken({
          accessToken: spotifyTokens.accessToken,
          expiresAt: spotifyTokens.expiresAt || null,
        });
        return;
      }
      
      // Otherwise, try to fetch from backend (user_integrations table)
      console.log('[SpotifyData] Fetching token from backend...');
      try {
        const response = await api.get(`/auth/spotify/token?user_id=${user.id}`);
        if (response.success && response.data?.accessToken) {
          console.log('[SpotifyData] Got token from backend');
          setLocalToken({
            accessToken: response.data.accessToken,
            expiresAt: response.data.expiresAt || null,
          });
        } else {
          console.log('[SpotifyData] No token from backend:', response.error);
          setLocalToken(null);
        }
      } catch (err) {
        console.warn('[SpotifyData] Backend token fetch failed:', err);
        setLocalToken(null);
      }
    };

    fetchBackendToken();
  }, [isAuthenticated, user?.id, spotifyTokens]);


  // Track token expiry time
  useEffect(() => {
    if (localToken?.expiresAt) {
      setState(prev => ({ ...prev, tokenExpiresAt: localToken.expiresAt! }));
      
      // Log expiry info
      const now = Date.now();
      const timeLeft = localToken.expiresAt - now;
      if (timeLeft > 0) {
        console.log(`[SpotifyData] Token expires in ${Math.round(timeLeft / 1000 / 60)} minutes`);
      } else {
        console.warn('[SpotifyData] Token is already expired');
      }
    }
  }, [localToken?.expiresAt]);

  // Clear all data when tokens are removed (disconnect)
  useEffect(() => {
    if (!localToken) {
      console.log('[SpotifyData] Tokens cleared, resetting all data');
      setState({
        recentlyPlayed: [],
        topTracks: [],
        topArtists: [],
        playlists: [],
        currentlyPlaying: null,
        isLoading: false,
        error: null,
        tokenExpiresAt: null,
      });
    }
  }, [localToken]);


  /**
   * Make authenticated Spotify API call
   */
  const spotifyFetch = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> => {
    if (!localToken?.accessToken) {
      console.warn('[SpotifyData] No access token available');
      return null;
    }

    // Check if token is expired before making the call
    if (localToken.expiresAt && Date.now() > localToken.expiresAt) {
      console.warn('[SpotifyData] Token is expired, skipping API call');
      setState(prev => ({ ...prev, error: 'Spotify session expired. Please reconnect Spotify.' }));
      return null;
    }

    try {
      const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${localToken.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle token expiration
      if (response.status === 401) {
        console.warn('[SpotifyData] Received 401 - Spotify token invalid/expired');
        setState(prev => ({ ...prev, error: 'Spotify session expired. Please reconnect Spotify.' }));
        return null;
      }

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('[SpotifyData] API error:', error);
      throw error;
    }
  }, [localToken]);


  /**
   * Fetch recently played tracks
   */
  const fetchRecentlyPlayed = useCallback(async (limit = 20): Promise<RecentlyPlayedItem[]> => {
    try {
      const data = await spotifyFetch<{ items: RecentlyPlayedItem[] }>(
        `/me/player/recently-played?limit=${limit}`
      );
      return data?.items || [];
    } catch (error) {
      console.error('[SpotifyData] Error fetching recently played:', error);
      return [];
    }
  }, [spotifyFetch]);

  /**
   * Fetch user's top tracks
   */
  const fetchTopTracks = useCallback(async (
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20
  ): Promise<SpotifyTrack[]> => {
    try {
      const data = await spotifyFetch<{ items: SpotifyTrack[] }>(
        `/me/top/tracks?time_range=${timeRange}&limit=${limit}`
      );
      return data?.items || [];
    } catch (error) {
      console.error('[SpotifyData] Error fetching top tracks:', error);
      return [];
    }
  }, [spotifyFetch]);

  /**
   * Fetch user's top artists
   */
  const fetchTopArtists = useCallback(async (
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20
  ): Promise<SpotifyArtist[]> => {
    try {
      const data = await spotifyFetch<{ items: SpotifyArtist[] }>(
        `/me/top/artists?time_range=${timeRange}&limit=${limit}`
      );
      return data?.items || [];
    } catch (error) {
      console.error('[SpotifyData] Error fetching top artists:', error);
      return [];
    }
  }, [spotifyFetch]);

  /**
   * Fetch user's playlists
   */
  const fetchPlaylists = useCallback(async (limit = 50): Promise<SpotifyPlaylist[]> => {
    try {
      const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
        `/me/playlists?limit=${limit}`
      );
      return data?.items || [];
    } catch (error) {
      console.error('[SpotifyData] Error fetching playlists:', error);
      return [];
    }
  }, [spotifyFetch]);

  /**
   * Fetch currently playing track
   */
  const fetchCurrentlyPlaying = useCallback(async (): Promise<CurrentlyPlaying | null> => {
    try {
      const data = await spotifyFetch<CurrentlyPlaying>('/me/player/currently-playing');
      return data;
    } catch (error) {
      console.error('[SpotifyData] Error fetching currently playing:', error);
      return null;
    }
  }, [spotifyFetch]);

  /**
   * Load all Spotify data
   */
  const loadAllData = useCallback(async () => {
    if (!localToken?.accessToken) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Not connected to Spotify' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [recentlyPlayed, topTracks, topArtists, playlists, currentlyPlaying] = await Promise.all([
        fetchRecentlyPlayed(10),
        fetchTopTracks('short_term', 10),
        fetchTopArtists('short_term', 10),
        fetchPlaylists(20),
        fetchCurrentlyPlaying(),
      ]);

      setState(prev => ({
        ...prev,
        recentlyPlayed,
        topTracks,
        topArtists,
        playlists,
        currentlyPlaying,
        isLoading: false,
        error: null,
      }));

      console.log('[SpotifyData] Loaded all data:', {
        recentlyPlayed: recentlyPlayed.length,
        topTracks: topTracks.length,
        topArtists: topArtists.length,
        playlists: playlists.length,
        currentlyPlaying: !!currentlyPlaying,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to load Spotify data',
      }));
    }
  }, [localToken, fetchRecentlyPlayed, fetchTopTracks, fetchTopArtists, fetchPlaylists, fetchCurrentlyPlaying]);

  // Load data when Spotify access becomes available
  useEffect(() => {
    if (localToken?.accessToken) {
      loadAllData();
    }
  }, [localToken, loadAllData]);

  // Calculate time until token expires (for UI display if needed)
  const getTokenExpiryInfo = useCallback(() => {
    if (!state.tokenExpiresAt) return null;
    const now = Date.now();
    const remaining = state.tokenExpiresAt - now;
    return {
      expiresAt: new Date(state.tokenExpiresAt),
      remainingMs: remaining,
      remainingMinutes: Math.max(0, Math.round(remaining / 1000 / 60)),
      isExpired: remaining <= 0,
    };
  }, [state.tokenExpiresAt]);

  // Computed value for hasSpotifyAccess based on localToken
  const hasSpotifyAccessComputed = !!localToken?.accessToken;

  return {
    ...state,
    hasSpotifyAccess: hasSpotifyAccessComputed,
    // Individual fetch methods for manual refresh
    fetchRecentlyPlayed,
    fetchTopTracks,
    fetchTopArtists,
    fetchPlaylists,
    fetchCurrentlyPlaying,
    // Refresh all data
    refresh: loadAllData,
    // Token management (expiry info only - refresh not possible with Supabase OAuth)
    getTokenExpiryInfo,
  };
}

export default useSpotifyData;
