/**
 * Shared Types for Backend
 * These mirror/extend the frontend types
 */

// --- Music Types ---

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  coverUrl: string;
  mood?: string;
  previewUrl?: string | null;
  spotifyUri?: string;
  externalUrl?: string;
}

export type MusicProvider = 'SPOTIFY' | 'YOUTUBE' | 'APPLE' | 'LASTFM';

// --- API Types ---

export type ApiScope = 'player:read' | 'player:control' | 'queue:manage' | 'ai:generate';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: ApiScope[];
  createdAt: number;
  lastUsed?: number;
}

// --- Webhook Types ---

export type WebhookEvent = 
  | 'SONG_CHANGED' 
  | 'PLAYBACK_PAUSED' 
  | 'PLAYBACK_RESUMED' 
  | 'MOOD_CHANGED'
  | 'FAVORITE_ADDED'
  | 'PLAYLIST_GENERATED';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
  failureCount: number;
}

// --- Auth Types ---

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface LastFmSession {
  name: string;
  key: string;
  subscriber: boolean;
}

// --- Playback Types ---

export interface PlaybackState {
  isPlaying: boolean;
  currentSong: Song | null;
  position: number;
  duration: number;
  volume: number;
}

export interface MoodData {
  time: string;
  score: number;
  label: string;
}

// --- WebSocket Event Types ---

export interface ServerToClientEvents {
  'song:changed': (song: Song | null) => void;
  'playback:state': (state: PlaybackState) => void;
  'queue:updated': (queue: Song[]) => void;
  'mood:changed': (mood: MoodData) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'player:play': (songId?: string) => void;
  'player:pause': () => void;
  'player:next': () => void;
  'player:previous': () => void;
  'player:volume': (percent: number) => void;
  'queue:add': (song: Song) => void;
  'queue:remove': (songId: string) => void;
}

// --- API Request/Response Types ---

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SearchRequest {
  query: string;
  provider?: MusicProvider;
  limit?: number;
}

export interface PlaylistGenerateRequest {
  prompt: string;
  provider?: MusicProvider;
}
