/**
 * Last.fm Integration Service
 * Real API integration for scrobbling, music discovery, and social features
 * 
 * API Documentation: https://www.last.fm/api
 */

import { Song } from '../types';

const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/';

// Get API key from environment or localStorage (user can configure in UI)
const getApiKey = (): string => {
  return localStorage.getItem('lastfm_api_key') || process.env.LASTFM_API_KEY || '';
};

const getSharedSecret = (): string => {
  return localStorage.getItem('lastfm_shared_secret') || process.env.LASTFM_SHARED_SECRET || '';
};

const getSessionKey = (): string | null => {
  return localStorage.getItem('lastfm_session_key');
};

export interface LastFmSession {
  name: string;
  key: string;
  subscriber: boolean;
}

export interface LastFmTrack {
  name: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  url: string;
  playcount?: number;
  listeners?: number;
}

export interface LastFmArtist {
  name: string;
  url: string;
  imageUrl?: string;
  playcount?: number;
}

// --- UTILITIES ---

// Use blueimp-md5 library for reliable MD5 hashing (Last.fm API requirement)
import md5 from 'blueimp-md5';

/**
 * Generate API signature for authenticated requests
 */
function generateSignature(params: Record<string, string>): string {
  const secret = getSharedSecret();
  const sortedKeys = Object.keys(params).sort();
  let signatureString = '';
  
  for (const key of sortedKeys) {
    signatureString += key + params[key];
  }
  signatureString += secret;
  
  // Debug: Log what we're hashing
  console.log('[Last.fm Sig] Sorted keys:', sortedKeys);
  console.log('[Last.fm Sig] String to hash (first 100 chars):', signatureString.substring(0, 100) + '...');
  console.log('[Last.fm Sig] String length:', signatureString.length);
  
  // Test MD5 with known value
  const testHash = md5('hello');
  const expectedHash = '5d41402abc4b2a76b9719d911017c592';
  console.log('[Last.fm Sig] MD5 test: md5("hello") =', testHash);
  console.log('[Last.fm Sig] Expected:', expectedHash);
  console.log('[Last.fm Sig] MD5 working correctly:', testHash === expectedHash);
  
  const result = md5(signatureString);
  console.log('[Last.fm Sig] Final signature:', result);
  
  return result;
}

/**
 * Make Last.fm API request
 */
async function lastfmRequest(
  method: string, 
  params: Record<string, string> = {},
  requiresAuth: boolean = false
): Promise<any> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Last.fm API key not configured');
  }

  const requestParams: Record<string, string> = {
    method,
    api_key: apiKey,
    format: 'json',
    ...params
  };

  if (requiresAuth) {
    const sessionKey = getSessionKey();
    if (!sessionKey) {
      throw new Error('Last.fm authentication required');
    }
    requestParams.sk = sessionKey;
    requestParams.api_sig = generateSignature(requestParams);
  }

  const queryString = new URLSearchParams(requestParams).toString();
  const url = `${LASTFM_API_BASE}?${queryString}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.message || 'Last.fm API error');
  }

  return data;
}

// --- AUTHENTICATION ---

/**
 * Get the Last.fm auth URL for user to authorize
 */
export function getLastFmAuthUrl(callbackUrl: string): string {
  const apiKey = getApiKey();
  if (!apiKey) return '';
  
  return `${LASTFM_AUTH_URL}?api_key=${apiKey}&cb=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Complete auth flow with the token received from callback
 */
export async function authenticateWithToken(token: string): Promise<LastFmSession | null> {
  try {
    const apiKey = getApiKey();
    const secret = getSharedSecret();
    
    // Debug: Log what we're working with
    console.log('[Last.fm Auth] API Key:', apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING');
    console.log('[Last.fm Auth] Secret:', secret ? secret.substring(0, 4) + '...' : 'MISSING');
    console.log('[Last.fm Auth] Token:', token ? token.substring(0, 8) + '...' : 'MISSING');
    
    if (!apiKey || !secret) {
      console.error('[Last.fm Auth] Missing API key or secret!');
      return null;
    }
    
    const params: Record<string, string> = {
      method: 'auth.getSession',
      api_key: apiKey,
      token: token
    };
    
    // Generate signature
    const sig = generateSignature(params);
    console.log('[Last.fm Auth] Generated signature:', sig);
    
    params.api_sig = sig;
    params.format = 'json';

    const queryString = new URLSearchParams(params).toString();
    const url = `${LASTFM_API_BASE}?${queryString}`;
    console.log('[Last.fm Auth] Request URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('[Last.fm Auth] Response status:', response.status);
    console.log('[Last.fm Auth] Response data:', data);

    if (data.error) {
      console.error('[Last.fm Auth] API Error:', data.error, data.message);
      return null;
    }

    if (data.session) {
      const session: LastFmSession = {
        name: data.session.name,
        key: data.session.key,
        subscriber: data.session.subscriber === '1'
      };
      
      // Store session
      localStorage.setItem('lastfm_session_key', session.key);
      localStorage.setItem('lastfm_session_name', session.name);
      
      console.log('[Last.fm Auth] Success! Logged in as:', session.name);
      return session;
    }
    return null;
  } catch (e) {
    console.error('[Last.fm Auth] Exception:', e);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getSessionKey();
}

/**
 * Get current session info
 */
export function getSession(): { name: string; key: string } | null {
  const key = getSessionKey();
  const name = localStorage.getItem('lastfm_session_name');
  if (key && name) {
    return { name, key };
  }
  return null;
}

/**
 * Logout / clear session
 */
export function logout(): void {
  localStorage.removeItem('lastfm_session_key');
  localStorage.removeItem('lastfm_session_name');
}

// --- SCROBBLING ---

/**
 * Scrobble a track (report that user listened to it)
 * Call this when track has played for >30 seconds or >50% of duration
 */
export async function scrobbleTrack(
  artist: string, 
  track: string, 
  album?: string,
  timestamp?: number
): Promise<boolean> {
  try {
    const params: Record<string, string> = {
      artist,
      track,
      timestamp: (timestamp || Math.floor(Date.now() / 1000)).toString()
    };
    if (album) params.album = album;

    await lastfmRequest('track.scrobble', params, true);
    return true;
  } catch (e) {
    console.error('Scrobble failed:', e);
    return false;
  }
}

/**
 * Update "Now Playing" status
 * Call this when a track starts playing
 */
export async function updateNowPlaying(
  artist: string, 
  track: string, 
  album?: string
): Promise<boolean> {
  try {
    const params: Record<string, string> = { artist, track };
    if (album) params.album = album;

    await lastfmRequest('track.updateNowPlaying', params, true);
    return true;
  } catch (e) {
    console.error('Now playing update failed:', e);
    return false;
  }
}

/**
 * Love a track (add to loved tracks)
 */
export async function loveTrack(artist: string, track: string): Promise<boolean> {
  try {
    await lastfmRequest('track.love', { artist, track }, true);
    return true;
  } catch (e) {
    console.error('Love track failed:', e);
    return false;
  }
}

/**
 * Unlove a track
 */
export async function unloveTrack(artist: string, track: string): Promise<boolean> {
  try {
    await lastfmRequest('track.unlove', { artist, track }, true);
    return true;
  } catch (e) {
    console.error('Unlove track failed:', e);
    return false;
  }
}

// --- DISCOVERY (No auth required) ---

/**
 * Get similar tracks to a given track
 */
export async function getSimilarTracks(
  artist: string, 
  track: string, 
  limit: number = 10
): Promise<LastFmTrack[]> {
  try {
    const data = await lastfmRequest('track.getSimilar', {
      artist,
      track,
      limit: limit.toString()
    });

    return (data.similartracks?.track || []).map((t: any) => ({
      name: t.name,
      artist: t.artist?.name || 'Unknown',
      url: t.url,
      imageUrl: t.image?.find((i: any) => i.size === 'large')?.['#text'],
      playcount: parseInt(t.playcount || '0')
    }));
  } catch (e) {
    console.error('Get similar tracks failed:', e);
    return [];
  }
}

/**
 * Get top tracks globally or by tag
 */
export async function getTopTracks(tag?: string, limit: number = 20): Promise<LastFmTrack[]> {
  try {
    const method = tag ? 'tag.getTopTracks' : 'chart.getTopTracks';
    const params: Record<string, string> = { limit: limit.toString() };
    if (tag) params.tag = tag;

    const data = await lastfmRequest(method, params);
    const tracks = tag ? data.tracks?.track : data.tracks?.track;

    return (tracks || []).map((t: any) => ({
      name: t.name,
      artist: t.artist?.name || t.artist || 'Unknown',
      url: t.url,
      imageUrl: t.image?.find((i: any) => i.size === 'large')?.['#text'],
      playcount: parseInt(t.playcount || '0'),
      listeners: parseInt(t.listeners || '0')
    }));
  } catch (e) {
    console.error('Get top tracks failed:', e);
    return [];
  }
}

/**
 * Search for tracks
 */
export async function searchTracks(query: string, limit: number = 10): Promise<LastFmTrack[]> {
  try {
    const data = await lastfmRequest('track.search', {
      track: query,
      limit: limit.toString()
    });

    return (data.results?.trackmatches?.track || []).map((t: any) => ({
      name: t.name,
      artist: t.artist,
      url: t.url,
      imageUrl: t.image?.find((i: any) => i.size === 'large')?.['#text'],
      listeners: parseInt(t.listeners || '0')
    }));
  } catch (e) {
    console.error('Search tracks failed:', e);
    return [];
  }
}

/**
 * Get track info including tags, wiki, etc.
 */
export async function getTrackInfo(
  artist: string, 
  track: string
): Promise<{
  name: string;
  artist: string;
  album?: string;
  wiki?: string;
  tags: string[];
  playcount: number;
  listeners: number;
} | null> {
  try {
    const data = await lastfmRequest('track.getInfo', { artist, track });
    const t = data.track;

    return {
      name: t.name,
      artist: t.artist?.name || 'Unknown',
      album: t.album?.title,
      wiki: t.wiki?.summary?.replace(/<[^>]*>/g, ''), // Strip HTML
      tags: (t.toptags?.tag || []).map((tag: any) => tag.name),
      playcount: parseInt(t.playcount || '0'),
      listeners: parseInt(t.listeners || '0')
    };
  } catch (e) {
    console.error('Get track info failed:', e);
    return null;
  }
}

// --- USER STATS (Auth required for some) ---

/**
 * Get user's recent tracks
 */
export async function getRecentTracks(
  user?: string, 
  limit: number = 20
): Promise<LastFmTrack[]> {
  try {
    const session = getSession();
    const username = user || session?.name;
    if (!username) throw new Error('No user specified');

    const data = await lastfmRequest('user.getRecentTracks', {
      user: username,
      limit: limit.toString()
    });

    return (data.recenttracks?.track || []).map((t: any) => ({
      name: t.name,
      artist: t.artist?.['#text'] || 'Unknown',
      album: t.album?.['#text'],
      url: t.url,
      imageUrl: t.image?.find((i: any) => i.size === 'large')?.['#text']
    }));
  } catch (e) {
    console.error('Get recent tracks failed:', e);
    return [];
  }
}

/**
 * Get user's top artists
 */
export async function getTopArtists(
  user?: string,
  period: 'overall' | '7day' | '1month' | '3month' | '6month' | '12month' = '1month',
  limit: number = 10
): Promise<LastFmArtist[]> {
  try {
    const session = getSession();
    const username = user || session?.name;
    if (!username) throw new Error('No user specified');

    const data = await lastfmRequest('user.getTopArtists', {
      user: username,
      period,
      limit: limit.toString()
    });

    return (data.topartists?.artist || []).map((a: any) => ({
      name: a.name,
      url: a.url,
      imageUrl: a.image?.find((i: any) => i.size === 'large')?.['#text'],
      playcount: parseInt(a.playcount || '0')
    }));
  } catch (e) {
    console.error('Get top artists failed:', e);
    return [];
  }
}

// --- HELPER: Convert LastFmTrack to Song ---

export function lastfmTrackToSong(track: LastFmTrack): Song {
  return {
    id: `lastfm-${track.name}-${track.artist}`.replace(/\s+/g, '-').toLowerCase(),
    title: track.name,
    artist: track.artist,
    album: track.album,
    duration: '0:00', // Last.fm doesn't provide duration
    coverUrl: track.imageUrl || `https://picsum.photos/200/200?random=${Math.random()}`,
    mood: 'Last.fm',
    externalUrl: track.url
  };
}

/**
 * Configure Last.fm API credentials
 */
export function configureLastFm(apiKey: string, sharedSecret: string): void {
  localStorage.setItem('lastfm_api_key', apiKey);
  localStorage.setItem('lastfm_shared_secret', sharedSecret);
}

/**
 * Check if Last.fm is configured
 */
export function isConfigured(): boolean {
  return !!getApiKey();
}
