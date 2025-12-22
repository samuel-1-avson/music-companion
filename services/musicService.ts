import { Song, MusicProvider } from '../types';
import { searchSpotifyTracks } from './spotifyService';

export interface MusicResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  duration: number; // seconds
  source: 'YOUTUBE' | 'ITUNES' | 'DEEZER';
  downloadUrl?: string; // For iTunes/Deezer previews
  videoId?: string; // For YouTube
}

// List of public Invidious instances to rotate through - Updated Dec 2024
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pizza',
  'https://invidious.jing.rocks',
  'https://yt.artemislena.eu'
];

const getRandomInstance = () => {
  return INVIDIOUS_INSTANCES[Math.floor(Math.random() * INVIDIOUS_INSTANCES.length)];
};

// Helper to fetch JSON with CORS proxy fallback
const fetchJson = async (url: string) => {
    // Try Proxy immediately for Invidious/Deezer to save time on timeouts and CORS
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    return await response.json();
};

const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// --- PROVIDER IMPLEMENTATIONS ---

const searchYouTubeInternal = async (query: string): Promise<MusicResult[]> => {
    try {
      const instance = getRandomInstance();
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
      
      const data = await fetchJson(url);
      
      if (Array.isArray(data)) {
        return data.slice(0, 10).map((item: any) => ({
          id: item.videoId,
          title: item.title,
          artist: item.author,
          album: 'YouTube',
          artworkUrl: `https://img.youtube.com/vi/${item.videoId}/0.jpg`,
          duration: item.lengthSeconds,
          source: 'YOUTUBE',
          videoId: item.videoId
        }));
      }
      return [];
    } catch (e) {
      console.warn("Invidious Search failed", e);
      return [];
    }
};

const searchAppleInternal = async (query: string): Promise<MusicResult[]> => {
    try {
        const encodedQuery = encodeURIComponent(query);
        const iTunesUrl = `https://itunes.apple.com/search?term=${encodedQuery}&media=music&entity=song&limit=12`;
        
        let data;
        try {
           const res = await fetch(iTunesUrl);
           if (res.ok) data = await res.json();
           else throw new Error("Direct iTunes failed");
        } catch {
           data = await fetchJson(iTunesUrl);
        }
        
        return (data.results || []).map((item: any) => ({
           id: item.trackId.toString(),
           title: item.trackName,
           artist: item.artistName,
           album: item.collectionName,
           artworkUrl: item.artworkUrl100.replace('100x100', '600x600'),
           duration: item.trackTimeMillis / 1000,
           source: 'ITUNES',
           downloadUrl: item.previewUrl
        }));
     } catch (e) {
        console.error("Apple Music search failed", e);
        return [];
     }
};

const searchDeezerInternal = async (query: string): Promise<MusicResult[]> => {
    try {
        const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=12`;
        const data = await fetchJson(url);
        
        return (data.data || []).map((item: any) => ({
            id: item.id.toString(),
            title: item.title,
            artist: item.artist.name,
            album: item.album.title,
            artworkUrl: item.album.cover_medium,
            duration: item.duration,
            source: 'DEEZER',
            downloadUrl: item.preview
        }));
    } catch (e) {
        console.error("Deezer search failed", e);
        return [];
    }
};

// --- PUBLIC API ---

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Extract video ID from backend ID (strips 'yt-' prefix if present)
const extractVideoId = (id: string): string => {
  if (id.startsWith('yt-')) {
    return id.substring(3);
  }
  return id;
};

// Search via backend (uses YouTube API if configured)
const searchViaBackend = async (query: string): Promise<MusicResult[]> => {
  const url = `${BACKEND_URL}/api/music/search?q=${encodeURIComponent(query)}&provider=YOUTUBE&limit=12`;
  console.log('[searchViaBackend] Fetching:', url);
  
  try {
    const res = await fetch(url);
    console.log('[searchViaBackend] Response status:', res.status, res.ok);
    
    if (!res.ok) {
      console.error('[searchViaBackend] Response not OK:', res.status);
      throw new Error('Backend search failed');
    }
    
    const data = await res.json();
    console.log('[searchViaBackend] Data received:', data.success, 'count:', data.data?.length);
    
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      const results = data.data.map((item: any) => {
        const videoId = extractVideoId(item.id);
        console.log('[searchViaBackend] Mapping item:', item.id, '->', videoId);
        return {
          id: videoId,
          title: item.title,
          artist: item.artist,
          album: item.album || 'YouTube',
          artworkUrl: item.coverUrl || `https://img.youtube.com/vi/${videoId}/0.jpg`,
          duration: parseDuration(item.duration),
          source: 'YOUTUBE' as const,
          videoId: videoId
        };
      });
      console.log('[searchViaBackend] Returning', results.length, 'YouTube results');
      return results;
    }
    console.log('[searchViaBackend] No data in response');
    return [];
  } catch (e) {
    console.error('[searchViaBackend] Error:', e);
    return [];
  }
};

// Parse duration string like "3:45" to seconds
const parseDuration = (dur: string): number => {
  if (!dur || typeof dur !== 'string') return 0;
  const parts = dur.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

export const searchMusic = async (query: string): Promise<MusicResult[]> => {
  console.log('[searchMusic] Searching for:', query);
  
  // 1. Try backend YouTube API (most reliable if API key configured)
  try {
    const backend = await searchViaBackend(query);
    if (backend.length > 0) {
      console.log('[searchMusic] Got results from backend:', backend.length);
      return backend;
    }
  } catch (e) {
    console.warn('[searchMusic] Backend search failed:', e);
  }
  
  // 2. Fallback to Invidious (client-side)
  try {
    const yt = await searchYouTubeInternal(query);
    if (yt.length > 0) {
      console.log('[searchMusic] Got results from Invidious:', yt.length);
      return yt;
    }
  } catch (e) {
    console.warn('[searchMusic] Invidious search failed:', e);
  }
  
  // 3. Final fallback to iTunes (most reliable, no API key needed)
  console.log('[searchMusic] Falling back to iTunes/Apple Music...');
  const apple = await searchAppleInternal(query);
  if (apple.length > 0) {
    console.log('[searchMusic] Got results from iTunes:', apple.length);
    return apple;
  }

  console.warn('[searchMusic] All sources failed, no results');
  return [];
};

export const searchUnified = async (
    provider: MusicProvider, 
    query: string, 
    spotifyToken?: string | null
): Promise<Song[]> => {
    if (!query) return [];

    let results: MusicResult[] = [];
    
    // 1. Fetch RAW results based on provider
    try {
        switch (provider) {
            case 'SPOTIFY':
                if (spotifyToken) {
                    // Spotify has its own mapped return type, return immediately
                    return await searchSpotifyTracks(spotifyToken, query);
                } else {
                    // Fallback if token missing
                    console.warn("Spotify selected but no token. Falling back to YouTube.");
                    results = await searchYouTubeInternal(query);
                }
                break;
            case 'YOUTUBE':
                results = await searchYouTubeInternal(query);
                break;
            case 'APPLE':
                results = await searchAppleInternal(query);
                break;
            case 'DEEZER':
                results = await searchDeezerInternal(query);
                break;
            default:
                results = await searchYouTubeInternal(query);
        }
    } catch (e) {
        console.error("Unified search error", e);
        return [];
    }

    // 2. Map to Song interface
    // Note: YouTube results won't have a direct 'previewUrl' playable in Audio element 
    // unless we extract the stream. For search results list, we usually trigger play 
    // which then resolves the stream.
    
    return results.map(r => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        album: r.album,
        duration: formatDuration(r.duration),
        coverUrl: r.artworkUrl,
        mood: provider, // Label the source
        previewUrl: r.downloadUrl, // For Apple/Deezer this works. For YouTube it is undefined.
        externalUrl: r.source === 'YOUTUBE' ? `https://youtube.com/watch?v=${r.id}` : undefined,
        // Helper for YouTube playback resolution later
        spotifyUri: r.source === 'YOUTUBE' ? `yt:${r.id}` : undefined 
    }));
};

export const getYouTubeAudioStream = async (videoId: string): Promise<string | null> => {
  // Try multiple instances to find a working stream
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}`;
      const data = await fetchJson(url);
      
      // Look for audio-only adaptive formats first
      const adaptive = data.adaptiveFormats || [];
      const audioStreams = adaptive.filter((f: any) => f.type.startsWith('audio/'));
      
      // Sort by bitrate (highest first)
      audioStreams.sort((a: any, b: any) => parseInt(b.bitrate) - parseInt(a.bitrate));
      
      if (audioStreams.length > 0) {
         return audioStreams[0].url;
      }
      
      // Fallback to formatStreams (video+audio)
      const formats = data.formatStreams || [];
      if (formats.length > 0) {
         return formats[0].url;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
};

export const downloadAudioAsBlob = async (url: string): Promise<Blob | null> => {
  if (!url) return null;
  
  try {
    // Try direct fetch first
    try {
        const response = await fetch(url);
        if (response.ok) return await response.blob();
    } catch(e) {
        // Direct failed
    }

    // Fallback to corsproxy.io which handles streams better than allorigins
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Proxy download failed");
    return await response.blob();
  } catch (e) {
    console.error("Download failed", e);
    return null;
  }
};
