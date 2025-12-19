import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface HistoryItem {
  id: string;
  song_id: string;
  title: string;
  artist: string;
  cover_url?: string;
  played_at: string;
}

const MAX_HISTORY_ITEMS = 100;
const HISTORY_STORAGE_KEY = 'music_companion_history';

/**
 * useHistory - Track listening history with Supabase sync
 * Falls back to localStorage when not authenticated
 */
export function useHistory() {
  const { user, isAuthenticated } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history on mount or auth change
  useEffect(() => {
    // Clear state immediately when user changes to prevent stale data
    setHistory([]);
    setIsLoading(true);

    if (isAuthenticated && user) {
      loadHistory();
    } else {
      // Only load localStorage for completely unauthenticated guests
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        try {
          setHistory(JSON.parse(stored));
        } catch (e) {
          console.error('[History] Failed to parse localStorage:', e);
        }
      }
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]); // Trigger on user.id change specifically

  // Load history from Supabase
  const loadHistory = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(MAX_HISTORY_ITEMS);

      if (error) throw error;
      
      setHistory(data || []);
      console.log('[History] Loaded', data?.length || 0, 'items');
    } catch (err) {
      console.error('[History] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Add song to history
  const addToHistory = useCallback(async (song: { id: string; title: string; artist: string; coverUrl?: string }) => {
    const newItem: HistoryItem = {
      id: `local_${Date.now()}`,
      song_id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.coverUrl,
      played_at: new Date().toISOString(),
    };

    if (!isAuthenticated || !user) {
      // Guest mode: save to localStorage
      const updated = [newItem, ...history.filter(h => h.song_id !== song.id)].slice(0, MAX_HISTORY_ITEMS);
      setHistory(updated);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('user_history')
        .insert({
          user_id: user.id,
          song_id: song.id,
          title: song.title,
          artist: song.artist,
          cover_url: song.coverUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state, removing duplicates
      setHistory(prev => [data, ...prev.filter(h => h.song_id !== song.id)].slice(0, MAX_HISTORY_ITEMS));
      console.log('[History] Added:', song.title);
      return true;
    } catch (err) {
      console.error('[History] Add error:', err);
      return false;
    }
  }, [isAuthenticated, user, history]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setHistory([]);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
      return true;
    }

    try {
      const { error } = await supabase
        .from('user_history')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setHistory([]);
      console.log('[History] Cleared');
      return true;
    } catch (err) {
      console.error('[History] Clear error:', err);
      return false;
    }
  }, [isAuthenticated, user]);

  // Get recent plays (last N items)
  const getRecentPlays = useCallback((count: number = 10): HistoryItem[] => {
    return history.slice(0, count);
  }, [history]);

  // Check if song was recently played
  const wasRecentlyPlayed = useCallback((songId: string): boolean => {
    return history.slice(0, 20).some(h => h.song_id === songId);
  }, [history]);

  return {
    history,
    isLoading,
    addToHistory,
    clearHistory,
    getRecentPlays,
    wasRecentlyPlayed,
    refresh: loadHistory,
  };
}

export default useHistory;
