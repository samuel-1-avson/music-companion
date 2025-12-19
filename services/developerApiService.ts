/**
 * Developer API Service
 * Provides a REST-like API for third-party developers to control Music Companion
 * 
 * This creates a global `window.MusicCompanionAPI` object that developers can use
 */

import { Song, MoodData } from '../types';

// --- TYPES ---

export type ApiScope = 'player:read' | 'player:control' | 'queue:manage' | 'ai:generate';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: ApiScope[];
  createdAt: number;
  lastUsed?: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentSong: Song | null;
  position: number; // seconds
  duration: number; // seconds
  volume: number; // 0-100
}

export type ApiEventType = 
  | 'songChanged' 
  | 'playbackStateChanged' 
  | 'queueUpdated' 
  | 'moodChanged'
  | 'apiKeyUsed';

export interface ApiEvent {
  type: ApiEventType;
  timestamp: number;
  data: any;
}

// --- API KEY MANAGEMENT ---

const API_KEYS_STORAGE_KEY = 'mc_developer_api_keys';

/**
 * Generate a secure random API key
 */
function generateSecureKey(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const base64 = btoa(String.fromCharCode(...array));
  return `mc_${base64.replace(/[+/=]/g, '').substring(0, 32)}`;
}

/**
 * Load all API keys from storage
 */
export function loadApiKeys(): ApiKey[] {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save API keys to storage
 */
function saveApiKeys(keys: ApiKey[]): void {
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

/**
 * Create a new API key with specified scopes
 */
export function createApiKey(name: string, scopes: ApiScope[]): ApiKey {
  const keys = loadApiKeys();
  
  const newKey: ApiKey = {
    id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name,
    key: generateSecureKey(),
    scopes,
    createdAt: Date.now()
  };
  
  keys.push(newKey);
  saveApiKeys(keys);
  
  // Dispatch event for logging
  dispatchApiEvent('apiKeyUsed', { action: 'created', keyId: newKey.id, name });
  
  return newKey;
}

/**
 * Validate an API key and return its scopes
 */
export function validateApiKey(key: string): { valid: boolean; scopes: ApiScope[]; keyId?: string } {
  const keys = loadApiKeys();
  const found = keys.find(k => k.key === key);
  
  if (found) {
    // Update last used
    found.lastUsed = Date.now();
    saveApiKeys(keys);
    
    return { valid: true, scopes: found.scopes, keyId: found.id };
  }
  
  return { valid: false, scopes: [] };
}

/**
 * Check if a key has a specific scope
 */
export function hasScope(key: string, scope: ApiScope): boolean {
  const validation = validateApiKey(key);
  return validation.valid && validation.scopes.includes(scope);
}

/**
 * Revoke an API key
 */
export function revokeApiKey(keyId: string): boolean {
  const keys = loadApiKeys();
  const index = keys.findIndex(k => k.id === keyId);
  
  if (index !== -1) {
    const removed = keys.splice(index, 1);
    saveApiKeys(keys);
    dispatchApiEvent('apiKeyUsed', { action: 'revoked', keyId, name: removed[0].name });
    return true;
  }
  
  return false;
}

/**
 * Get API key by ID (without exposing the actual key)
 */
export function getApiKeyInfo(keyId: string): Omit<ApiKey, 'key'> | null {
  const keys = loadApiKeys();
  const found = keys.find(k => k.id === keyId);
  if (found) {
    const { key, ...rest } = found;
    return rest;
  }
  return null;
}

// --- EVENT SYSTEM ---

type EventCallback = (event: ApiEvent) => void;
const eventListeners: Map<ApiEventType, EventCallback[]> = new Map();
const eventLog: ApiEvent[] = [];
const MAX_EVENT_LOG = 100;

/**
 * Subscribe to API events
 */
export function onApiEvent(type: ApiEventType, callback: EventCallback): () => void {
  if (!eventListeners.has(type)) {
    eventListeners.set(type, []);
  }
  eventListeners.get(type)!.push(callback);
  
  // Return unsubscribe function
  return () => {
    const listeners = eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) listeners.splice(index, 1);
    }
  };
}

/**
 * Dispatch an API event
 */
export function dispatchApiEvent(type: ApiEventType, data: any): void {
  const event: ApiEvent = {
    type,
    timestamp: Date.now(),
    data
  };
  
  // Add to log
  eventLog.unshift(event);
  if (eventLog.length > MAX_EVENT_LOG) eventLog.pop();
  
  // Notify listeners
  const listeners = eventListeners.get(type);
  if (listeners) {
    listeners.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.error('API event listener error:', e);
      }
    });
  }
  
  // Also dispatch a custom DOM event for external scripts
  window.dispatchEvent(new CustomEvent(`mc:${type}`, { detail: event }));
}

/**
 * Get recent event log
 */
export function getEventLog(limit: number = 20): ApiEvent[] {
  return eventLog.slice(0, limit);
}

// --- DEVELOPER API CLASS ---

/**
 * The main Developer API exposed to third parties
 * This gets attached to window.MusicCompanionAPI
 */
export class MusicCompanionAPI {
  private apiKey: string | null = null;
  private handlers: {
    play?: (songId?: string) => void;
    pause?: () => void;
    next?: () => void;
    previous?: () => void;
    getQueue?: () => Song[];
    addToQueue?: (song: Song) => void;
    getCurrentSong?: () => Song | null;
    getPlaybackState?: () => PlaybackState;
    getMoodData?: () => MoodData[];
    generatePlaylist?: (prompt: string) => Promise<Song[]>;
  } = {};

  /**
   * Authenticate with an API key
   */
  authenticate(key: string): { success: boolean; scopes: ApiScope[] } {
    const validation = validateApiKey(key);
    if (validation.valid) {
      this.apiKey = key;
      return { success: true, scopes: validation.scopes };
    }
    return { success: false, scopes: [] };
  }

  /**
   * Check if authenticated and has required scope
   */
  private checkAuth(requiredScope: ApiScope): boolean {
    if (!this.apiKey) {
      console.warn('[MusicCompanionAPI] Not authenticated. Call authenticate(key) first.');
      return false;
    }
    if (!hasScope(this.apiKey, requiredScope)) {
      console.warn(`[MusicCompanionAPI] Missing required scope: ${requiredScope}`);
      return false;
    }
    return true;
  }

  // --- INTERNAL: Register handlers from App ---
  
  _registerHandlers(handlers: typeof this.handlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // --- PLAYER CONTROL ---

  /**
   * Play a song by ID or resume current
   */
  play(songId?: string): boolean {
    if (!this.checkAuth('player:control')) return false;
    if (this.handlers.play) {
      this.handlers.play(songId);
      return true;
    }
    return false;
  }

  /**
   * Pause playback
   */
  pause(): boolean {
    if (!this.checkAuth('player:control')) return false;
    if (this.handlers.pause) {
      this.handlers.pause();
      return true;
    }
    return false;
  }

  /**
   * Skip to next track
   */
  next(): boolean {
    if (!this.checkAuth('player:control')) return false;
    if (this.handlers.next) {
      this.handlers.next();
      return true;
    }
    return false;
  }

  /**
   * Go to previous track
   */
  previous(): boolean {
    if (!this.checkAuth('player:control')) return false;
    if (this.handlers.previous) {
      this.handlers.previous();
      return true;
    }
    return false;
  }

  // --- PLAYER READ ---

  /**
   * Get current song
   */
  getCurrentSong(): Song | null {
    if (!this.checkAuth('player:read')) return null;
    return this.handlers.getCurrentSong?.() || null;
  }

  /**
   * Get full playback state
   */
  getPlaybackState(): PlaybackState | null {
    if (!this.checkAuth('player:read')) return null;
    return this.handlers.getPlaybackState?.() || null;
  }

  /**
   * Get mood history data
   */
  getMoodData(): MoodData[] {
    if (!this.checkAuth('player:read')) return [];
    return this.handlers.getMoodData?.() || [];
  }

  // --- QUEUE MANAGEMENT ---

  /**
   * Get current queue
   */
  getQueue(): Song[] {
    if (!this.checkAuth('queue:manage')) return [];
    return this.handlers.getQueue?.() || [];
  }

  /**
   * Add a song to queue
   */
  addToQueue(song: Song): boolean {
    if (!this.checkAuth('queue:manage')) return false;
    if (this.handlers.addToQueue) {
      this.handlers.addToQueue(song);
      return true;
    }
    return false;
  }

  // --- AI FEATURES ---

  /**
   * Generate a playlist from a text prompt
   */
  async generatePlaylist(prompt: string): Promise<Song[]> {
    if (!this.checkAuth('ai:generate')) return [];
    if (this.handlers.generatePlaylist) {
      return await this.handlers.generatePlaylist(prompt);
    }
    return [];
  }

  // --- EVENT SUBSCRIPTION ---

  /**
   * Subscribe to song changes
   */
  onSongChange(callback: (song: Song | null) => void): () => void {
    return onApiEvent('songChanged', (event) => callback(event.data));
  }

  /**
   * Subscribe to playback state changes
   */
  onPlaybackStateChange(callback: (state: PlaybackState) => void): () => void {
    return onApiEvent('playbackStateChanged', (event) => callback(event.data));
  }

  /**
   * Subscribe to queue updates
   */
  onQueueUpdate(callback: (queue: Song[]) => void): () => void {
    return onApiEvent('queueUpdated', (event) => callback(event.data));
  }

  /**
   * Get API version
   */
  getVersion(): string {
    return '1.0.0';
  }
}

// --- INITIALIZATION ---

/**
 * Initialize the Developer API and attach to window
 */
export function initializeDeveloperApi(): MusicCompanionAPI {
  const api = new MusicCompanionAPI();
  (window as any).MusicCompanionAPI = api;
  
  console.log(
    '%c🎵 Music Companion API Ready\n' +
    '%cAccess via: window.MusicCompanionAPI\n' +
    'Docs: Extensions > Developer API',
    'font-size: 16px; font-weight: bold; color: #1DB954;',
    'font-size: 12px; color: #888;'
  );
  
  return api;
}

/**
 * Get the initialized API instance
 */
export function getDeveloperApi(): MusicCompanionAPI | null {
  return (window as any).MusicCompanionAPI || null;
}
