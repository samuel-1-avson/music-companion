
import { Song, SpotifyProfile } from '../types';

const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-top-read",
  "user-library-read"
];

export const getSpotifyAuthUrl = (clientId: string, redirectUri: string) => {
  return `${SPOTIFY_AUTH_ENDPOINT}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES.join(" "))}&response_type=token&show_dialog=true`;
};

export const parseSpotifyToken = (hash: string): string | null => {
  try {
    const stringToParse = hash.startsWith('#') ? hash.substring(1) : hash;
    const params = new URLSearchParams(stringToParse);
    return params.get("access_token");
  } catch (e) {
    console.error("Error parsing token", e);
    return null;
  }
};

export const parseSpotifyError = (hash: string): string | null => {
  try {
    const stringToParse = hash.startsWith('#') ? hash.substring(1) : hash;
    const params = new URLSearchParams(stringToParse);
    return params.get("error");
  } catch (e) {
    return null;
  }
};

export const getUserProfile = async (token: string): Promise<SpotifyProfile | null> => {
  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error("Error fetching profile", e);
    return null;
  }
};

const mapSpotifyTrackToSong = (track: any): Song => {
    // Convert ms to mm:ss
    const minutes = Math.floor(track.duration_ms / 60000);
    const seconds = ((track.duration_ms % 60000) / 1000).toFixed(0);
    const duration = `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;

    return {
      id: track.id,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(", "),
      album: track.album.name,
      duration: duration,
      coverUrl: track.album.images[0]?.url || '',
      previewUrl: track.preview_url,
      spotifyUri: track.uri,
      externalUrl: track.external_urls.spotify,
      mood: 'Spotify' // Placeholder
    };
};

export const searchSpotifyTrack = async (token: string, query: string): Promise<Song | null> => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const track = data.tracks?.items?.[0];

    if (!track) return null;

    return mapSpotifyTrackToSong(track);
  } catch (e) {
    console.error("Spotify Search Error", e);
    return null;
  }
};

export const searchSpotifyTracks = async (token: string, query: string): Promise<Song[]> => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=12`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.tracks?.items || []).map(mapSpotifyTrackToSong);
  } catch (e) {
    console.error("Spotify Search Error", e);
    return [];
  }
};

export const remoteControl = {
  play: async (token: string, uri?: string) => {
    const body: any = {};
    if (uri) {
       if (uri.startsWith('spotify:track')) body.uris = [uri];
       else body.context_uri = uri;
    }
    
    await fetch(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  },
  resume: async (token: string) => {
    await fetch(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  pause: async (token: string) => {
    await fetch(`https://api.spotify.com/v1/me/player/pause`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  next: async (token: string) => {
    await fetch(`https://api.spotify.com/v1/me/player/next`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  previous: async (token: string) => {
    await fetch(`https://api.spotify.com/v1/me/player/previous`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  setVolume: async (token: string, volumePercent: number) => {
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volumePercent}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  getActiveDevice: async (token: string) => {
      try {
          const res = await fetch(`https://api.spotify.com/v1/me/player/devices`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return data.devices?.find((d: any) => d.is_active);
      } catch (e) { return null; }
  }
};

// --- ENHANCED SPOTIFY FEATURES ---

/**
 * Get user's recently played tracks
 */
export const getRecentlyPlayed = async (token: string, limit: number = 20): Promise<Song[]> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map((item: any) => mapSpotifyTrackToSong(item.track));
  } catch (e) {
    console.error("Get recently played error:", e);
    return [];
  }
};

/**
 * Get user's top tracks
 */
export const getTopTracks = async (
  token: string, 
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<Song[]> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.items || []).map(mapSpotifyTrackToSong);
  } catch (e) {
    console.error("Get top tracks error:", e);
    return [];
  }
};

/**
 * Create a new playlist
 */
export const createPlaylist = async (
  token: string,
  userId: string,
  name: string,
  description: string = '',
  isPublic: boolean = false
): Promise<{ id: string; url: string } | null> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          public: isPublic
        })
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      id: data.id,
      url: data.external_urls?.spotify || ''
    };
  } catch (e) {
    console.error("Create playlist error:", e);
    return null;
  }
};

/**
 * Add tracks to a playlist
 */
export const addTracksToPlaylist = async (
  token: string,
  playlistId: string,
  trackUris: string[]
): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: trackUris })
      }
    );
    
    return response.ok;
  } catch (e) {
    console.error("Add tracks to playlist error:", e);
    return false;
  }
};

/**
 * Save a track to user's library (Liked Songs)
 */
export const addToLikedSongs = async (token: string, trackId: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/tracks`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [trackId] })
      }
    );
    
    return response.ok;
  } catch (e) {
    console.error("Add to liked songs error:", e);
    return false;
  }
};

/**
 * Remove a track from user's library
 */
export const removeFromLikedSongs = async (token: string, trackId: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/tracks`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: [trackId] })
      }
    );
    
    return response.ok;
  } catch (e) {
    console.error("Remove from liked songs error:", e);
    return false;
  }
};

/**
 * Check if tracks are saved in user's library
 */
export const checkLikedSongs = async (token: string, trackIds: string[]): Promise<boolean[]> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/me/tracks/contains?ids=${trackIds.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (!response.ok) return trackIds.map(() => false);
    
    return await response.json();
  } catch (e) {
    console.error("Check liked songs error:", e);
    return trackIds.map(() => false);
  }
};

/**
 * Get audio features (tempo, energy, etc.) for a track
 */
export const getAudioFeatures = async (
  token: string, 
  trackId: string
): Promise<{
  tempo: number;
  energy: number;
  danceability: number;
  valence: number; // happiness
  acousticness: number;
} | null> => {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      tempo: data.tempo,
      energy: data.energy,
      danceability: data.danceability,
      valence: data.valence,
      acousticness: data.acousticness
    };
  } catch (e) {
    console.error("Get audio features error:", e);
    return null;
  }
};
