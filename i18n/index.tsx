import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Supported languages
export type Language = 'en' | 'es' | 'fr' | 'de' | 'ja';

// Translation keys type
export interface Translations {
  // Navigation
  dashboard: string;
  chat: string;
  live: string;
  extensions: string;
  theLab: string;
  offline: string;
  arcade: string;
  focus: string;
  settings: string;
  profile: string;
  
  // Dashboard
  welcomeBack: string;
  searchPlaceholder: string;
  quickActions: string;
  recentlyPlayed: string;
  moodToday: string;
  
  // Player
  nowPlaying: string;
  queue: string;
  lyrics: string;
  shuffle: string;
  repeat: string;
  volume: string;
  
  // Settings
  language: string;
  theme: string;
  crossfade: string;
  notifications: string;
  
  // Common
  play: string;
  pause: string;
  next: string;
  previous: string;
  search: string;
  save: string;
  cancel: string;
  loading: string;
  error: string;
  success: string;
  
  // Features
  smartDJ: string;
  radioStations: string;
  discoverArtists: string;
  musicTrivia: string;
}

// English translations (default)
const en: Translations = {
  dashboard: 'Dashboard',
  chat: 'Chat',
  live: 'Live Mode',
  extensions: 'Extensions',
  theLab: 'The Lab',
  offline: 'Offline Hub',
  arcade: 'Arcade',
  focus: 'Focus Mode',
  settings: 'Settings',
  profile: 'Profile',
  
  welcomeBack: 'Welcome Back',
  searchPlaceholder: 'Search songs, artists, or ask AI...',
  quickActions: 'Quick Actions',
  recentlyPlayed: 'Recently Played',
  moodToday: 'Your Mood Today',
  
  nowPlaying: 'Now Playing',
  queue: 'Queue',
  lyrics: 'Lyrics',
  shuffle: 'Shuffle',
  repeat: 'Repeat',
  volume: 'Volume',
  
  language: 'Language',
  theme: 'Theme',
  crossfade: 'Crossfade',
  notifications: 'Notifications',
  
  play: 'Play',
  pause: 'Pause',
  next: 'Next',
  previous: 'Previous',
  search: 'Search',
  save: 'Save',
  cancel: 'Cancel',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  
  smartDJ: 'Smart DJ',
  radioStations: 'Radio Stations',
  discoverArtists: 'Discover Artists',
  musicTrivia: 'Music Trivia',
};

// Spanish translations
const es: Translations = {
  dashboard: 'Inicio',
  chat: 'Chat',
  live: 'Modo En Vivo',
  extensions: 'Extensiones',
  theLab: 'El Laboratorio',
  offline: 'Hub Offline',
  arcade: 'Arcade',
  focus: 'Modo Enfoque',
  settings: 'Configuración',
  profile: 'Perfil',
  
  welcomeBack: 'Bienvenido de Nuevo',
  searchPlaceholder: 'Buscar canciones, artistas, o pregunta a la IA...',
  quickActions: 'Acciones Rápidas',
  recentlyPlayed: 'Reproducido Recientemente',
  moodToday: 'Tu Estado de Ánimo Hoy',
  
  nowPlaying: 'Reproduciendo Ahora',
  queue: 'Cola',
  lyrics: 'Letras',
  shuffle: 'Aleatorio',
  repeat: 'Repetir',
  volume: 'Volumen',
  
  language: 'Idioma',
  theme: 'Tema',
  crossfade: 'Transición',
  notifications: 'Notificaciones',
  
  play: 'Reproducir',
  pause: 'Pausar',
  next: 'Siguiente',
  previous: 'Anterior',
  search: 'Buscar',
  save: 'Guardar',
  cancel: 'Cancelar',
  loading: 'Cargando...',
  error: 'Error',
  success: 'Éxito',
  
  smartDJ: 'DJ Inteligente',
  radioStations: 'Estaciones de Radio',
  discoverArtists: 'Descubrir Artistas',
  musicTrivia: 'Trivia Musical',
};

// French translations
const fr: Translations = {
  dashboard: 'Tableau de Bord',
  chat: 'Discussion',
  live: 'Mode Live',
  extensions: 'Extensions',
  theLab: 'Le Labo',
  offline: 'Hub Hors Ligne',
  arcade: 'Arcade',
  focus: 'Mode Focus',
  settings: 'Paramètres',
  profile: 'Profil',
  
  welcomeBack: 'Bon Retour',
  searchPlaceholder: 'Rechercher des chansons, artistes, ou demander à l\'IA...',
  quickActions: 'Actions Rapides',
  recentlyPlayed: 'Récemment Écouté',
  moodToday: 'Votre Humeur Aujourd\'hui',
  
  nowPlaying: 'En Lecture',
  queue: 'File d\'Attente',
  lyrics: 'Paroles',
  shuffle: 'Aléatoire',
  repeat: 'Répéter',
  volume: 'Volume',
  
  language: 'Langue',
  theme: 'Thème',
  crossfade: 'Fondu Enchaîné',
  notifications: 'Notifications',
  
  play: 'Lecture',
  pause: 'Pause',
  next: 'Suivant',
  previous: 'Précédent',
  search: 'Rechercher',
  save: 'Sauvegarder',
  cancel: 'Annuler',
  loading: 'Chargement...',
  error: 'Erreur',
  success: 'Succès',
  
  smartDJ: 'DJ Intelligent',
  radioStations: 'Stations Radio',
  discoverArtists: 'Découvrir Artistes',
  musicTrivia: 'Quiz Musical',
};

// German translations
const de: Translations = {
  dashboard: 'Übersicht',
  chat: 'Chat',
  live: 'Live Modus',
  extensions: 'Erweiterungen',
  theLab: 'Das Labor',
  offline: 'Offline Hub',
  arcade: 'Arcade',
  focus: 'Fokus Modus',
  settings: 'Einstellungen',
  profile: 'Profil',
  
  welcomeBack: 'Willkommen Zurück',
  searchPlaceholder: 'Songs, Künstler suchen oder KI fragen...',
  quickActions: 'Schnellaktionen',
  recentlyPlayed: 'Kürzlich Gespielt',
  moodToday: 'Deine Stimmung Heute',
  
  nowPlaying: 'Wird Gespielt',
  queue: 'Warteschlange',
  lyrics: 'Liedtexte',
  shuffle: 'Zufällig',
  repeat: 'Wiederholen',
  volume: 'Lautstärke',
  
  language: 'Sprache',
  theme: 'Design',
  crossfade: 'Überblenden',
  notifications: 'Benachrichtigungen',
  
  play: 'Abspielen',
  pause: 'Pause',
  next: 'Nächster',
  previous: 'Vorheriger',
  search: 'Suchen',
  save: 'Speichern',
  cancel: 'Abbrechen',
  loading: 'Laden...',
  error: 'Fehler',
  success: 'Erfolg',
  
  smartDJ: 'Smart DJ',
  radioStations: 'Radiosender',
  discoverArtists: 'Künstler Entdecken',
  musicTrivia: 'Musik Quiz',
};

// Japanese translations
const ja: Translations = {
  dashboard: 'ダッシュボード',
  chat: 'チャット',
  live: 'ライブモード',
  extensions: '拡張機能',
  theLab: 'ラボ',
  offline: 'オフラインハブ',
  arcade: 'アーケード',
  focus: 'フォーカスモード',
  settings: '設定',
  profile: 'プロフィール',
  
  welcomeBack: 'おかえりなさい',
  searchPlaceholder: '曲、アーティストを検索、またはAIに質問...',
  quickActions: 'クイックアクション',
  recentlyPlayed: '最近再生した曲',
  moodToday: '今日の気分',
  
  nowPlaying: '再生中',
  queue: 'キュー',
  lyrics: '歌詞',
  shuffle: 'シャッフル',
  repeat: 'リピート',
  volume: '音量',
  
  language: '言語',
  theme: 'テーマ',
  crossfade: 'クロスフェード',
  notifications: '通知',
  
  play: '再生',
  pause: '一時停止',
  next: '次へ',
  previous: '前へ',
  search: '検索',
  save: '保存',
  cancel: 'キャンセル',
  loading: '読み込み中...',
  error: 'エラー',
  success: '成功',
  
  smartDJ: 'スマートDJ',
  radioStations: 'ラジオ局',
  discoverArtists: 'アーティスト発見',
  musicTrivia: '音楽クイズ',
};

// All translations
const translations: Record<Language, Translations> = { en, es, fr, de, ja };

// Language names for display
export const languageNames: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
};

// Context
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Provider
interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  // Load saved language
  useEffect(() => {
    const saved = localStorage.getItem('app_language') as Language;
    if (saved && translations[saved]) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </I18nContext.Provider>
  );
};

// Hook
export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    // Return English as fallback if no provider
    return { language: 'en' as Language, setLanguage: () => {}, t: en };
  }
  return context;
};

export default I18nProvider;
