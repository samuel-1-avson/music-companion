
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

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  SETTINGS = 'SETTINGS',
  FOCUS = 'FOCUS'
}

export interface LiveSessionStatus {
  isConnected: boolean;
  isSpeaking: boolean;
  error: string | null;
}
