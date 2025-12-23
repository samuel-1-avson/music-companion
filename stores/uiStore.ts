/**
 * UI Store - Zustand state management for UI state
 * Replaces useState hooks in App.tsx for UI-related state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppView, Theme, MoodData } from '../types';

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
      // Initial State
      currentView: AppView.DASHBOARD,
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
      setCurrentView: (view) => set({ currentView: view }),
      
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
