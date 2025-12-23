/**
 * UI Store - Zustand state management for UI state
 * Replaces useState hooks in App.tsx for UI-related state
 * Enhanced with URL hash routing for page persistence
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppView, Theme, MoodData } from '../types';

// Route mapping: AppView enum value → URL hash path
const VIEW_TO_ROUTE: Record<AppView, string> = {
  [AppView.DASHBOARD]: '',
  [AppView.CHAT]: 'chat',
  [AppView.LIVE]: 'live',
  [AppView.PROFILE]: 'profile',
  [AppView.COLLAB]: 'playlists',
  [AppView.OFFLINE]: 'offline',
  [AppView.ARCADE]: 'arcade',
  [AppView.LAB]: 'lab',
  [AppView.EXTENSIONS]: 'integrations',
  [AppView.SETTINGS]: 'settings',
  [AppView.FOCUS]: 'focus',
};

// Reverse mapping: URL hash path → AppView enum value
const ROUTE_TO_VIEW: Record<string, AppView> = Object.entries(VIEW_TO_ROUTE).reduce(
  (acc, [view, route]) => ({ ...acc, [route]: view as AppView }),
  {} as Record<string, AppView>
);

/**
 * Get initial view from URL hash or default to DASHBOARD
 */
function getInitialViewFromURL(): AppView {
  if (typeof window === 'undefined') return AppView.DASHBOARD;
  
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') return AppView.DASHBOARD;
  
  // Parse hash: "#/chat" → "chat"
  const route = hash.replace(/^#\/?/, '');
  return ROUTE_TO_VIEW[route] || AppView.DASHBOARD;
}

/**
 * Update URL hash without triggering a page reload
 */
function updateURLHash(view: AppView): void {
  if (typeof window === 'undefined') return;
  
  const route = VIEW_TO_ROUTE[view];
  const newHash = route ? `#/${route}` : '#/';
  
  // Only update if different to avoid unnecessary history entries
  if (window.location.hash !== newHash) {
    window.history.pushState(null, '', newHash);
  }
}

interface UIState {
  // Navigation
  currentView: AppView;
  
  // Theme
  theme: Theme;
  isSmartTheme: boolean;
  
  // Modals & Panels
  showKeyboardHelp: boolean;
  showRadio: boolean;
  showArtistGraph: boolean;
  artistGraphSeed: string;
  
  // Error State
  errorMessage: string | null;
  
  // Greeting
  greeting: { message: string; action: string } | null;
  
  // Mood Tracking
  moodData: MoodData[];
  
  // Actions
  setCurrentView: (view: AppView) => void;
  navigateFromURL: () => void; // For handling browser back/forward
  setTheme: (theme: Theme) => void;
  toggleSmartTheme: () => void;
  setIsSmartTheme: (enabled: boolean) => void;
  
  setShowKeyboardHelp: (show: boolean | ((prev: boolean) => boolean)) => void;
  setShowRadio: (show: boolean) => void;
  setShowArtistGraph: (show: boolean) => void;
  setArtistGraphSeed: (seed: string) => void;
  
  setErrorMessage: (message: string | null) => void;
  clearError: () => void;
  
  setGreeting: (greeting: { message: string; action: string } | null) => void;
  
  setMoodData: (data: MoodData[] | ((prev: MoodData[]) => MoodData[])) => void;
  addMoodEntry: (entry: MoodData) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial State - read from URL
      currentView: getInitialViewFromURL(),
      theme: 'minimal',
      isSmartTheme: true,
      showKeyboardHelp: false,
      showRadio: false,
      showArtistGraph: false,
      artistGraphSeed: '',
      errorMessage: null,
      greeting: null,
      moodData: [{ time: '08:00', score: 50, label: 'Neutral' }],
      
      // Actions
      setCurrentView: (view) => {
        updateURLHash(view);
        set({ currentView: view });
      },
      
      // Handle browser back/forward navigation
      navigateFromURL: () => {
        const view = getInitialViewFromURL();
        set({ currentView: view });
      },
      
      setTheme: (theme) => set({ theme, isSmartTheme: false }),
      
      toggleSmartTheme: () => set(state => ({ isSmartTheme: !state.isSmartTheme })),
      
      setIsSmartTheme: (enabled) => set({ isSmartTheme: enabled }),
      
      setShowKeyboardHelp: (showOrUpdater) => {
        if (typeof showOrUpdater === 'function') {
          set(state => ({ showKeyboardHelp: showOrUpdater(state.showKeyboardHelp) }));
        } else {
          set({ showKeyboardHelp: showOrUpdater });
        }
      },
      
      setShowRadio: (show) => set({ showRadio: show }),
      
      setShowArtistGraph: (show) => set({ showArtistGraph: show }),
      
      setArtistGraphSeed: (seed) => set({ artistGraphSeed: seed }),
      
      setErrorMessage: (message) => set({ errorMessage: message }),
      
      clearError: () => set({ errorMessage: null }),
      
      setGreeting: (greeting) => set({ greeting }),
      
      setMoodData: (dataOrUpdater) => {
        if (typeof dataOrUpdater === 'function') {
          set(state => ({ moodData: dataOrUpdater(state.moodData) }));
        } else {
          set({ moodData: dataOrUpdater });
        }
      },
      
      addMoodEntry: (entry) => set(state => ({
        moodData: [...state.moodData.slice(-23), entry] // Keep last 24 entries
      }))
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        isSmartTheme: state.isSmartTheme
      })
    }
  )
);

// Export route utilities for use elsewhere
export { VIEW_TO_ROUTE, ROUTE_TO_VIEW, getInitialViewFromURL };
