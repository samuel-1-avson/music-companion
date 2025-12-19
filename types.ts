
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
  // Offline properties
  isOffline?: boolean;
  fileBlob?: Blob; 
  localUrl?: string;
  addedAt?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  type: 'text' | 'audio';
  timestamp: Date;
  attachments?: {
    type: 'image';
    url: string;
  }[];
}

export interface MoodData {
  time: string;
  score: number; // 0-100
  label: string;
}

export interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
  product?: string;
}

export type Theme = 
  | 'minimal'
  | 'material'
  | 'neumorphism'
  | 'glass'
  | 'neobrutalism'
  | 'retro';

export type MusicProvider = 'SPOTIFY' | 'YOUTUBE' | 'APPLE' | 'DEEZER' | 'LASTFM' | 'SOUNDCLOUD';

// --- DEVELOPER API TYPES ---

export type ApiScope = 'player:read' | 'player:control' | 'queue:manage' | 'ai:generate';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: ApiScope[];
  createdAt: number;
  lastUsed?: number;
}

// --- WEBHOOK TYPES ---

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

// --- LAST.FM TYPES ---

export interface LastFmSession {
  name: string;
  key: string;
  subscriber: boolean;
}

// --- EXTENSION TYPES ---

export type ExtensionType = 'browser' | 'vscode' | 'desktop';

export interface ExtensionContext {
  type: ExtensionType;
  context: string;
  metadata?: Record<string, any>;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  EXTENSIONS = 'EXTENSIONS',
  LAB = 'LAB',
  SETTINGS = 'SETTINGS',
  FOCUS = 'FOCUS',
  ARCADE = 'ARCADE',
  OFFLINE = 'OFFLINE',
  PROFILE = 'PROFILE',
  COLLAB = 'COLLAB'
}

export interface LiveSessionStatus {
  isConnected: boolean;
  isSpeaking: boolean;
  error: string | null;
}

export interface DashboardInsight {
  grade: string;
  title: string;
  recommendation: string;
  actionLabel: string;
  nextGenre: string;
}

// Web Speech API Types
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

export interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
