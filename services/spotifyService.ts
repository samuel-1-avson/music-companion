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