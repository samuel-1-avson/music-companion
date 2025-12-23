/**
 * Settings Store - Zustand state management for app settings
 * Replaces useState hooks in App.tsx for settings-related state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SleepTimer {
  minutes: number | null;
  endTime: number | null;
  remaining: number;
}

interface SettingsState {
  // User
  userName: string;
  userAvatar: string | null;
  
  // Audio Settings
  crossfadeDuration: number; // 0-12 seconds
  eqValues: number[]; // [Low, MidLow, Mid, MidHigh, High]
  
  // Sleep Timer
  sleepTimer: SleepTimer;
  
  // Spotify (Legacy)
  spotifyToken: string | null;
  
  // Actions
  setUserName: (name: string) => void;
  setUserAvatar: (avatar: string | null) => void;
  updateProfile: (name: string, avatar?: string) => void;
  
  setCrossfadeDuration: (duration: number) => void;
  setEQBand: (index: number, value: number) => void;
  setEQValues: (values: number[]) => void;
  resetEQ: () => void;
  
  startSleepTimer: (minutes: number) => void;
  updateSleepTimerRemaining: (remaining: number) => void;
  cancelSleepTimer: () => void;
  
  setSpotifyToken: (token: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial State
      userName: 'User',
      userAvatar: null,
      crossfadeDuration: 3,
      eqValues: [0, 0, 0, 0, 0],
      sleepTimer: {
        minutes: null,
        endTime: null,
        remaining: 0
      },
      spotifyToken: null,
      
      // Actions
      setUserName: (name) => set({ userName: name }),
      
      setUserAvatar: (avatar) => set({ userAvatar: avatar }),
      
      updateProfile: (name, avatar) => {
        set({ userName: name });
        if (avatar) set({ userAvatar: avatar });
      },
      
      setCrossfadeDuration: (duration) => set({ 
        crossfadeDuration: Math.max(0, Math.min(12, duration)) 
      }),
      
      setEQBand: (index, value) => {
        const { eqValues } = get();
        const newValues = [...eqValues];
        newValues[index] = Math.max(-12, Math.min(12, value));
        set({ eqValues: newValues });
      },
      
      setEQValues: (values) => set({ eqValues: values }),
      
      resetEQ: () => set({ eqValues: [0, 0, 0, 0, 0] }),
      
      startSleepTimer: (minutes) => {
        const endTime = Date.now() + minutes * 60 * 1000;
        set({
          sleepTimer: {
            minutes,
            endTime,
            remaining: minutes * 60
          }
        });
      },
      
      updateSleepTimerRemaining: (remaining) => {
        set(state => ({
          sleepTimer: {
            ...state.sleepTimer,
            remaining
          }
        }));
      },
      
      cancelSleepTimer: () => set({
        sleepTimer: {
          minutes: null,
          endTime: null,
          remaining: 0
        }
      }),
      
      setSpotifyToken: (token) => set({ spotifyToken: token })
    }),
    {
      name: 'settings-storage',
      partialize: (state) => ({
        userName: state.userName,
        userAvatar: state.userAvatar,
        crossfadeDuration: state.crossfadeDuration,
        eqValues: state.eqValues
      })
    }
  )
);
