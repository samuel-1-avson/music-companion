import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  equalizerPreset?: string;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  autoPlay: boolean;
  showLyrics: boolean;
  volume: number;
  repeatMode: 'off' | 'all' | 'one';
  shuffleEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  equalizerPreset: 'flat',
  crossfadeEnabled: false,
  crossfadeDuration: 5,
  autoPlay: true,
  showLyrics: true,
  volume: 0.8,
  repeatMode: 'off',
  shuffleEnabled: false,
};

const PREFS_STORAGE_KEY = 'music_companion_preferences';

/**
 * useUserPreferences - Manage user preferences with Supabase sync
 * Falls back to localStorage when not authenticated
 */
export function useUserPreferences() {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences on mount or auth change
  useEffect(() => {
    // Reset to defaults immediately when user changes to prevent stale data
    setPreferences(DEFAULT_PREFERENCES);
    setIsLoading(true);

    if (isAuthenticated && user) {
      loadPreferences();
    } else {
      // Only load localStorage for completely unauthenticated guests
      const stored = localStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        try {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
        } catch (e) {
          console.error('[Preferences] Failed to parse localStorage:', e);
        }
      }
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]); // Trigger on user.id change specifically

  // Load preferences from Supabase
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (data?.preferences) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
      }
      console.log('[Preferences] Loaded from Supabase');
    } catch (err) {
      console.error('[Preferences] Load error:', err);
      // Fall back to localStorage
      const stored = localStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        try {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
        } catch (e) { /* ignore */ }
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Save preferences
  const savePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    
    // Always save to localStorage as backup
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(newPrefs));

    if (!isAuthenticated || !user) {
      return true;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          preferences: newPrefs,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      console.log('[Preferences] Saved to Supabase');
      return true;
    } catch (err) {
      console.error('[Preferences] Save error:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, user, preferences]);

  // Update single preference
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ) => {
    return savePreferences({ [key]: value });
  }, [savePreferences]);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    return savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    isSaving,
    savePreferences,
    updatePreference,
    resetPreferences,
    refresh: loadPreferences,
  };
}

export default useUserPreferences;
