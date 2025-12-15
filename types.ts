
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
  | 'classic' 
  | 'cyber' 
  | 'forest' 
  | 'lavender' 
  | 'minimal'
  | 'midnight'
  | 'solar'
  | 'matrix'
  | 'synthwave'
  | 'glacier'
  | 'obsidian'
  | 'nebula'
  | 'sunset'
  | 'oceanic'
  | 'terminal'
  | 'sakura'
  | 'ember';

export type MusicProvider = 'SPOTIFY' | 'YOUTUBE' | 'APPLE' | 'DEEZER';

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
  PROFILE = 'PROFILE'
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
