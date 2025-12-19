/**
 * Backend API Client
 * Connects frontend to the backend server for all API calls
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Store tokens
let spotifyToken: string | null = null;

export function setSpotifyToken(token: string | null) {
  spotifyToken = token;
}

export function getSpotifyToken(): string | null {
  return spotifyToken;
}

// --- GENERIC FETCH ---

async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };
    
    // Add Spotify token if available
    if (spotifyToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${spotifyToken}`;
    }
    
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error(`API call failed: ${endpoint}`, error);
    return { success: false, error: error.message || 'Network error' };
  }
}

// --- HEALTH CHECK ---

export async function checkBackendHealth() {
  return apiCall<{
    status: string;
    services: { spotify: boolean; lastfm: boolean; gemini: boolean; discord: boolean };
  }>('/health');
}

// --- AUTH ---

export function getSpotifyAuthUrl(): string {
  return `${BACKEND_URL}/auth/spotify`;
}

export function getLastFmAuthUrl(): string {
  return `${BACKEND_URL}/auth/lastfm`;
}

export async function refreshSpotifyToken(refreshToken: string) {
  return apiCall<{ access_token: string; expires_in: number }>('/auth/spotify/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}

export async function getLastFmSession(token: string) {
  return apiCall<{ name: string; key: string; subscriber: boolean }>('/auth/lastfm/session', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

// --- MUSIC SEARCH ---

export async function searchMusic(query: string, provider: string = 'YOUTUBE', limit: number = 10) {
  return apiCall<any[]>(`/api/music/search?q=${encodeURIComponent(query)}&provider=${provider}&limit=${limit}`);
}

export async function getYouTubeStream(videoId: string) {
  return apiCall<{ url: string; type: string; bitrate: number }>(`/api/music/youtube/stream/${videoId}`);
}

export async function getSimilarTracks(artist: string, track: string, limit: number = 10) {
  return apiCall<any[]>(`/api/music/lastfm/similar?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&limit=${limit}`);
}

// --- AI ---

export async function generatePlaylist(prompt: string, provider: string = 'YOUTUBE', imageBase64?: string) {
  return apiCall<{ explanation: string; songs: any[] }>('/api/ai/playlist', {
    method: 'POST',
    body: JSON.stringify({ prompt, provider, imageBase64 })
  });
}

export async function analyzeSong(title: string, artist: string, lyrics?: string) {
  return apiCall<{ meaning: string; themes: string[]; mood: string }>('/api/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({ title, artist, lyrics })
  });
}

export async function getLyrics(title: string, artist: string) {
  return apiCall<{ lyrics: string }>('/api/ai/lyrics', {
    method: 'POST',
    body: JSON.stringify({ title, artist })
  });
}

export async function getAiGreeting(name: string) {
  return apiCall<{ greeting: string }>(`/api/ai/greeting?name=${encodeURIComponent(name)}`);
}

// --- DEVELOPER API ---

export async function getExtensionContext() {
  return apiCall<{
    vscode?: { activity: string; mood: string; language: string; timestamp: number };
    browser?: { category: string; mood: string; url: string; timestamp: number };
  }>('/api/dev/context');
}

// --- WEBHOOKS ---

export async function getWebhooks() {
  return apiCall<any[]>('/api/webhooks');
}

export async function createWebhook(name: string, url: string, events: string[], secret?: string) {
  return apiCall<any>('/api/webhooks', {
    method: 'POST',
    body: JSON.stringify({ name, url, events, secret })
  });
}

export async function deleteWebhook(id: string) {
  return apiCall<void>(`/api/webhooks/${id}`, { method: 'DELETE' });
}

export async function testWebhook(id: string) {
  return apiCall<{ success: boolean }>(`/api/webhooks/${id}/test`, { method: 'POST' });
}

// --- SOCKET.IO CONNECTION ---

export function connectWebSocket(onConnect: () => void, onDisconnect: () => void) {
  // For now, return a placeholder. We can add Socket.io client later
  console.log('WebSocket connection would be established here');
  return {
    disconnect: () => console.log('WebSocket disconnected'),
    on: (event: string, callback: Function) => {},
    emit: (event: string, data: any) => {}
  };
}

export default {
  checkBackendHealth,
  getSpotifyAuthUrl,
  getLastFmAuthUrl,
  refreshSpotifyToken,
  getLastFmSession,
  searchMusic,
  getYouTubeStream,
  getSimilarTracks,
  generatePlaylist,
  analyzeSong,
  getLyrics,
  getAiGreeting,
  getExtensionContext,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  setSpotifyToken,
  getSpotifyToken,
  connectWebSocket
};
