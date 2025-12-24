/**
 * Music API Routes
 * Proxy for external music services
 */
import { Router } from 'express';
import axios from 'axios';
import { config } from '../utils/config.js';
import type { Song, MusicProvider } from '../types/index.js';

const router = Router();

// CORS Proxy for APIs that block browser requests
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// --- SYSTEM TOKEN MANAGEMENT ---
let systemToken: { access_token: string; expires_at: number } | null = null;

async function getSystemSpotifyToken(): Promise<string> {
  // Return cached token if valid (buffer of 60s)
  if (systemToken && Date.now() < systemToken.expires_at - 60000) {
    return systemToken.access_token;
  }

  // Fetch new token
  const response = await axios.post('https://accounts.spotify.com/api/token', 
    new URLSearchParams({ grant_type: 'client_credentials' }), 
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  const { access_token, expires_in } = response.data;
  systemToken = {
    access_token,
    expires_at: Date.now() + (expires_in * 1000)
  };

  return access_token;
}

// --- UNIFIED SEARCH ---

/**
 * Search across music providers
 * GET /api/music/search?q=query&provider=YOUTUBE&limit=10
 */
router.get('/search', async (req, res) => {
  const { q, provider = 'YOUTUBE', limit = 10 } = req.query;

  if (!q) {
    return res.status(400).json({ success: false, error: 'Missing query parameter "q"' });
  }

  try {
    let results: Song[] = [];
    const limitNum = parseInt(limit as string, 10);

    switch (provider as MusicProvider) {
      case 'YOUTUBE':
        results = await searchYouTube(q as string, limitNum);
        break;
      case 'SPOTIFY':
        let token = req.headers.authorization?.replace('Bearer ', '');
        
        // If no user token, try to get system token (Client Credentials)
        if (!token && config.spotify.isConfigured) {
          try {
             token = await getSystemSpotifyToken();
          } catch (e) {
             console.error("Failed to get system token", e);
          }
        }

        if (token) {
          results = await searchSpotify(q as string, token, limitNum);
        } else {
          return res.status(401).json({ success: false, error: 'Spotify token required (system or user)' });
        }
        break;
      case 'APPLE':
        results = await searchAppleMusic(q as string, limitNum);
        break;
      case 'LASTFM':
        results = await searchLastFm(q as string, limitNum);
        break;
      default:
        results = await searchYouTube(q as string, limitNum);
    }

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('Music search error:', err.message);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// --- YOUTUBE ---

async function searchYouTube(query: string, limit: number): Promise<Song[]> {
  console.log(`[YouTube Search] Starting search for: "${query}" (limit: ${limit})`);
  
  // Use official YouTube Data API if configured (recommended)
  if (config.youtube.apiKey) {
    console.log('[YouTube Search] Trying YouTube Data API...');
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: query,
          type: 'video',
          videoCategoryId: '10', // Music category
          maxResults: limit,
          key: config.youtube.apiKey
        },
        timeout: 10000
      });
      
      if (response.data?.items?.length > 0) {
        console.log(`[YouTube Search] YouTube Data API SUCCESS: ${response.data.items.length} results`);
        return response.data.items.map((item: any) => ({
          id: `yt-${item.id.videoId}`,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          album: 'YouTube',
          duration: '0:00', // Duration requires additional API call
          coverUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
          mood: 'YouTube',
          spotifyUri: `yt:${item.id.videoId}`,
          externalUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
      }
      console.log('[YouTube Search] YouTube Data API returned 0 results');
    } catch (e: any) {
      console.error('[YouTube Search] YouTube Data API FAILED:', e.response?.data?.error?.message || e.message);
      // Fall through to try other methods
    }
  } else {
    console.log('[YouTube Search] YouTube Data API not configured (no YOUTUBE_API_KEY)');
  }
  
  // Try Piped API (free, no key needed) - Updated Dec 2024
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.r4fo.com',
    'https://pipedapi.adminforge.de',
    'https://api.piped.yt'
  ];
  
  for (const instance of pipedInstances) {
    console.log(`[YouTube Search] Trying Piped: ${instance}`);
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`;
      const response = await axios.get(url, { timeout: 8000 });
      
      if (response.data?.items?.length > 0) {
        console.log(`[YouTube Search] Piped SUCCESS (${instance}): ${response.data.items.length} results`);
        return response.data.items.slice(0, limit).map((item: any) => {
          const videoId = item.url?.replace('/watch?v=', '') || '';
          return {
            id: `yt-${videoId}`,
            title: item.title || 'Unknown',
            artist: item.uploaderName || 'Unknown Artist',
            album: 'YouTube',
            duration: formatDuration(item.duration || 0),
            coverUrl: item.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            mood: 'YouTube',
            spotifyUri: `yt:${videoId}`,
            externalUrl: `https://www.youtube.com/watch?v=${videoId}`
          };
        });
      }
      console.log(`[YouTube Search] Piped (${instance}) returned 0 results`);
    } catch (e: any) {
      console.log(`[YouTube Search] Piped FAILED (${instance}): ${e.message}`);
      continue;
    }
  }
  
  // Fallback to Invidious instances - Updated Dec 2024
  const invidInstances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
    'https://invidious.jing.rocks',
    'https://yt.artemislena.eu'
  ];

  for (const instance of invidInstances) {
    console.log(`[YouTube Search] Trying Invidious: ${instance}`);
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
      const response = await axios.get(url, { timeout: 5000 });
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log(`[YouTube Search] Invidious SUCCESS (${instance}): ${response.data.length} results`);
        return response.data.slice(0, limit).map((item: any) => ({
          id: `yt-${item.videoId}`,
          title: item.title,
          artist: item.author || 'Unknown Artist',
          album: 'YouTube',
          duration: formatDuration(item.lengthSeconds),
          coverUrl: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
          mood: 'YouTube',
          spotifyUri: `yt:${item.videoId}`,
          externalUrl: `https://www.youtube.com/watch?v=${item.videoId}`
        }));
      }
      console.log(`[YouTube Search] Invidious (${instance}) returned 0 results`);
    } catch (e: any) {
      console.log(`[YouTube Search] Invidious FAILED (${instance}): ${e.message}`);
      continue;
    }
  }

  console.log('[YouTube Search] ALL YouTube sources failed - falling back to iTunes');
  
  // Final fallback: Use iTunes search (reliable, no API key needed)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=${limit}`;
    const itunesResponse = await axios.get(itunesUrl, { timeout: 8000 });
    
    if (itunesResponse.data?.results?.length > 0) {
      console.log(`[YouTube Search] iTunes FALLBACK SUCCESS: ${itunesResponse.data.results.length} results`);
      return itunesResponse.data.results.map((track: any) => ({
        id: `itunes-${track.trackId}`,
        title: track.trackName,
        artist: track.artistName,
        album: track.collectionName || 'iTunes',
        duration: formatDuration(Math.floor(track.trackTimeMillis / 1000)),
        coverUrl: track.artworkUrl100?.replace('100x100', '400x400') || '',
        mood: 'iTunes',
        previewUrl: track.previewUrl,
        externalUrl: track.trackViewUrl
      }));
    }
  } catch (e: any) {
    console.log('[YouTube Search] iTunes fallback also failed:', e.message);
  }
  
  return [];
}

/**
 * Get YouTube audio stream URL
 * GET /api/music/youtube/stream/:videoId
 */
router.get('/youtube/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  console.log('[YouTube Stream] Fetching stream for:', videoId);

  // Updated Dec 2024 with more reliable instances
  const instances = [
    'https://vid.puffyan.us',
    'https://invidious.snopyta.org',
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
    'https://invidious.jing.rocks',
    'https://invidious.privacyredirect.com',
    'https://iv.melmac.space'
  ];

  for (const instance of instances) {
    try {
      const url = `${instance}/api/v1/videos/${videoId}`;
      console.log('[YouTube Stream] Trying:', instance);
      const response = await axios.get(url, { timeout: 8000 });
      
      const audioFormats = response.data.adaptiveFormats?.filter(
        (f: any) => f.type?.startsWith('audio/')
      );

      if (audioFormats?.length > 0) {
        // Get best quality audio
        const bestAudio = audioFormats.sort((a: any, b: any) => 
          (b.bitrate || 0) - (a.bitrate || 0)
        )[0];

        console.log('[YouTube Stream] SUCCESS from:', instance, 'bitrate:', bestAudio.bitrate);
        return res.json({
          success: true,
          data: {
            url: bestAudio.url,
            type: bestAudio.type,
            bitrate: bestAudio.bitrate
          }
        });
      } else {
        console.log('[YouTube Stream] No audio formats from:', instance);
      }
    } catch (e: any) {
      console.log('[YouTube Stream] Failed:', instance, e.message);
      continue;
    }
  }

  console.log('[YouTube Stream] All instances failed for:', videoId);
  res.status(404).json({ success: false, error: 'Stream not found' });
});

// --- SPOTIFY ---

async function searchSpotify(query: string, token: string, limit: number): Promise<Song[]> {
  try {
    const response = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: query, type: 'track', limit }
    });

    return response.data.tracks.items.map((track: any) => ({
      id: `sp-${track.id}`,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
      duration: formatDuration(Math.floor(track.duration_ms / 1000)),
      coverUrl: track.album.images?.[0]?.url || '',
      mood: 'Spotify',
      spotifyUri: track.uri,
      previewUrl: track.preview_url,
      externalUrl: track.external_urls?.spotify
    }));
  } catch (e) {
    console.error('Spotify search error:', e);
    return [];
  }
}

/**
 * Proxy Spotify API requests
 * GET /api/music/spotify/*
 */
router.get('/spotify/*', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'Spotify token required' });
  }

  const path = (req.params as Record<string, string>)[0];
  try {
    const response = await axios.get(`https://api.spotify.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: req.query
    });
    res.json({ success: true, data: response.data });
  } catch (err: any) {
    res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.error?.message || 'Spotify API error'
    });
  }
});

// --- APPLE MUSIC ---

async function searchAppleMusic(query: string, limit: number): Promise<Song[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=${limit}`;
    const response = await axios.get(url);

    return response.data.results.map((track: any) => ({
      id: `apple-${track.trackId}`,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      duration: formatDuration(Math.floor(track.trackTimeMillis / 1000)),
      coverUrl: track.artworkUrl100?.replace('100x100', '400x400') || '',
      mood: 'Apple Music',
      previewUrl: track.previewUrl,
      externalUrl: track.trackViewUrl
    }));
  } catch (e) {
    console.error('Apple Music search error:', e);
    return [];
  }
}

// --- LAST.FM ---

async function searchLastFm(query: string, limit: number): Promise<Song[]> {
  if (!config.lastfm.isConfigured) return [];

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.search',
        track: query,
        api_key: config.lastfm.apiKey,
        format: 'json',
        limit
      }
    });

    const tracks = response.data.results?.trackmatches?.track || [];
    return tracks.map((track: any) => ({
      id: `lfm-${track.name}-${track.artist}`.replace(/\s+/g, '-').toLowerCase(),
      title: track.name,
      artist: track.artist,
      album: 'Last.fm',
      duration: '0:00',
      coverUrl: track.image?.find((i: any) => i.size === 'large')?.['#text'] || 
                `https://picsum.photos/200/200?random=${Math.random()}`,
      mood: 'Last.fm',
      externalUrl: track.url
    }));
  } catch (e) {
    console.error('Last.fm search error:', e);
    return [];
  }
}

/**
 * Get similar tracks from Last.fm
 * GET /api/music/lastfm/similar?artist=&track=&limit=10
 */
router.get('/lastfm/similar', async (req, res) => {
  const { artist, track, limit = 10 } = req.query;

  if (!artist || !track) {
    return res.status(400).json({ success: false, error: 'Missing artist or track' });
  }

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.getSimilar',
        artist,
        track,
        api_key: config.lastfm.apiKey,
        format: 'json',
        limit: parseInt(limit as string, 10)
      }
    });

    const tracks = response.data.similartracks?.track || [];
    const results: Song[] = tracks.map((t: any) => ({
      id: `lfm-${t.name}-${t.artist?.name}`.replace(/\s+/g, '-').toLowerCase(),
      title: t.name,
      artist: t.artist?.name || 'Unknown',
      album: 'Similar',
      duration: '0:00',
      coverUrl: t.image?.find((i: any) => i.size === 'large')?.['#text'] || 
                `https://picsum.photos/200/200?random=${Math.random()}`,
      mood: 'Similar',
      externalUrl: t.url
    }));

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('Similar tracks error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get similar tracks' });
  }
});

/**
 * Get top tracks globally or by tag
 * GET /api/music/lastfm/top?tag=rock&limit=20
 */
router.get('/lastfm/top', async (req, res) => {
  const { tag, limit = 20 } = req.query;

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const method = tag ? 'tag.getTopTracks' : 'chart.getTopTracks';
    const params: Record<string, any> = {
      method,
      api_key: config.lastfm.apiKey,
      format: 'json',
      limit: parseInt(limit as string, 10)
    };
    if (tag) params.tag = tag;

    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', { params });
    const tracks = response.data.tracks?.track || [];
    
    const results: Song[] = tracks.map((t: any) => ({
      id: `lfm-${t.name}-${t.artist?.name || t.artist}`.replace(/\s+/g, '-').toLowerCase(),
      title: t.name,
      artist: t.artist?.name || t.artist || 'Unknown',
      album: tag ? `Top ${tag}` : 'Top Charts',
      duration: t.duration ? formatDuration(parseInt(t.duration)) : '0:00',
      coverUrl: t.image?.find((i: any) => i.size === 'large')?.['#text'] || 
                `https://picsum.photos/200/200?random=${Math.random()}`,
      mood: tag || 'Charts',
      externalUrl: t.url,
      playcount: parseInt(t.playcount || '0'),
      listeners: parseInt(t.listeners || '0')
    }));

    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('Top tracks error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get top tracks' });
  }
});

/**
 * Get track info (tags, wiki, play stats)
 * GET /api/music/lastfm/track?artist=&track=
 */
router.get('/lastfm/track', async (req, res) => {
  const { artist, track } = req.query;

  if (!artist || !track) {
    return res.status(400).json({ success: false, error: 'Missing artist or track' });
  }

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'track.getInfo',
        artist,
        track,
        api_key: config.lastfm.apiKey,
        format: 'json'
      }
    });

    const t = response.data.track;
    if (!t) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    res.json({
      success: true,
      data: {
        name: t.name,
        artist: t.artist?.name || 'Unknown',
        album: t.album?.title,
        albumCover: t.album?.image?.find((i: any) => i.size === 'large')?.['#text'],
        wiki: t.wiki?.summary?.replace(/<[^>]*>/g, ''), // Strip HTML
        tags: (t.toptags?.tag || []).map((tag: any) => tag.name),
        playcount: parseInt(t.playcount || '0'),
        listeners: parseInt(t.listeners || '0'),
        url: t.url,
        duration: t.duration ? formatDuration(parseInt(t.duration) / 1000) : null
      }
    });
  } catch (err: any) {
    console.error('Track info error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get track info' });
  }
});

/**
 * Get artist info
 * GET /api/music/lastfm/artist?artist=
 */
router.get('/lastfm/artist', async (req, res) => {
  const { artist } = req.query;

  if (!artist) {
    return res.status(400).json({ success: false, error: 'Missing artist' });
  }

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'artist.getInfo',
        artist,
        api_key: config.lastfm.apiKey,
        format: 'json'
      }
    });

    const a = response.data.artist;
    if (!a) {
      return res.status(404).json({ success: false, error: 'Artist not found' });
    }

    res.json({
      success: true,
      data: {
        name: a.name,
        bio: a.bio?.summary?.replace(/<[^>]*>/g, ''),
        tags: (a.tags?.tag || []).map((tag: any) => tag.name),
        playcount: parseInt(a.stats?.playcount || '0'),
        listeners: parseInt(a.stats?.listeners || '0'),
        similar: (a.similar?.artist || []).slice(0, 5).map((s: any) => s.name),
        image: a.image?.find((i: any) => i.size === 'large')?.['#text'],
        url: a.url
      }
    });
  } catch (err: any) {
    console.error('Artist info error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get artist info' });
  }
});

/**
 * Get top tags (genres)
 * GET /api/music/lastfm/tags?limit=20
 */
router.get('/lastfm/tags', async (req, res) => {
  const { limit = 20 } = req.query;

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'chart.getTopTags',
        api_key: config.lastfm.apiKey,
        format: 'json',
        limit: parseInt(limit as string, 10)
      }
    });

    const tags = response.data.tags?.tag || [];
    res.json({
      success: true,
      data: tags.map((t: any) => ({
        name: t.name,
        url: t.url,
        reach: parseInt(t.reach || '0'),
        taggings: parseInt(t.taggings || '0')
      }))
    });
  } catch (err: any) {
    console.error('Top tags error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get top tags' });
  }
});

/**
 * Get similar artists
 * GET /api/music/lastfm/similar-artists?artist=&limit=10
 */
router.get('/lastfm/similar-artists', async (req, res) => {
  const { artist, limit = 10 } = req.query;

  if (!artist) {
    return res.status(400).json({ success: false, error: 'Missing artist' });
  }

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        method: 'artist.getSimilar',
        artist,
        api_key: config.lastfm.apiKey,
        format: 'json',
        limit: parseInt(limit as string, 10)
      }
    });

    const artists = response.data.similarartists?.artist || [];
    res.json({
      success: true,
      data: artists.map((a: any) => ({
        name: a.name,
        match: parseFloat(a.match || '0'),
        image: a.image?.find((i: any) => i.size === 'large')?.['#text'],
        url: a.url
      }))
    });
  } catch (err: any) {
    console.error('Similar artists error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get similar artists' });
  }
});

/**
 * Get top artists globally or by tag
 * GET /api/music/lastfm/top-artists?tag=rock&limit=20
 */
router.get('/lastfm/top-artists', async (req, res) => {
  const { tag, limit = 20 } = req.query;

  if (!config.lastfm.isConfigured) {
    return res.status(503).json({ success: false, error: 'Last.fm not configured' });
  }

  try {
    const method = tag ? 'tag.getTopArtists' : 'chart.getTopArtists';
    const params: Record<string, any> = {
      method,
      api_key: config.lastfm.apiKey,
      format: 'json',
      limit: parseInt(limit as string, 10)
    };
    if (tag) params.tag = tag;

    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', { params });
    const artists = response.data.artists?.artist || response.data.topartists?.artist || [];
    
    res.json({
      success: true,
      data: artists.map((a: any) => ({
        name: a.name,
        playcount: parseInt(a.playcount || '0'),
        listeners: parseInt(a.listeners || '0'),
        image: a.image?.find((i: any) => i.size === 'large')?.['#text'],
        url: a.url
      }))
    });
  } catch (err: any) {
    console.error('Top artists error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get top artists' });
  }
});

// --- UTILS ---

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default router;
