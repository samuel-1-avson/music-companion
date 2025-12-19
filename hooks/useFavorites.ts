import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface FavoriteSong {
  id: string;
  song_id: string;
  title: string;
  artist: string;
  cover_url?: string;
  created_at: string;
}

/**
 * useFavorites - Manage user favorites with Supabase sync
 * Falls back to localStorage when not authenticated
 */
export function useFavorites() {
  const { user, isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites on mount or auth change
  useEffect(() => {
    // Clear state immediately when user changes to prevent stale data
    setFavorites([]);
    setIsLoading(true);

    if (isAuthenticated && user) {
      loadFavorites();
    } else {
      // Only load localStorage for completely unauthenticated guests
      const stored = localStorage.getItem('music_companion_favorites');
      if (stored) {
        try {
          setFavorites(JSON.parse(stored));
        } catch (e) {
          console.error('[Favorites] Failed to parse localStorage:', e);
        }
      }
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]); // Trigger on user.id change specifically

  // Load favorites from Supabase
  const loadFavorites = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setFavorites(data || []);
      console.log('[Favorites] Loaded', data?.length || 0, 'favorites');
    } catch (err) {
      console.error('[Favorites] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Add song to favorites
  const addFavorite = useCallback(async (song: { id: string; title: string; artist: string; coverUrl?: string }) => {
    if (!isAuthenticated || !user) {
      // Guest mode: save to localStorage
      const newFav: FavoriteSong = {
        id: `local_${Date.now()}`,
        song_id: song.id,
        title: song.title,
        artist: song.artist,
        cover_url: song.coverUrl,
        created_at: new Date().toISOString(),
      };
      const updated = [newFav, ...favorites];
      setFavorites(updated);
      localStorage.setItem('music_companion_favorites', JSON.stringify(updated));
      return true;
    }

    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          song_id: song.id,
          title: song.title,
          artist: song.artist,
          cover_url: song.coverUrl,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          console.log('[Favorites] Song already in favorites');
          return false;
        }
        throw error;
      }

      setFavorites(prev => [data, ...prev]);
      console.log('[Favorites] Added:', song.title);
      return true;
    } catch (err) {
      console.error('[Favorites] Add error:', err);
      return false;
    }
  }, [isAuthenticated, user, favorites]);

  // Remove song from favorites
  const removeFavorite = useCallback(async (songId: string) => {
    if (!isAuthenticated || !user) {
      // Guest mode
      const updated = favorites.filter(f => f.song_id !== songId);
      setFavorites(updated);
      localStorage.setItem('music_companion_favorites', JSON.stringify(updated));
      return true;
    }

    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('song_id', songId);

      if (error) throw error;

      setFavorites(prev => prev.filter(f => f.song_id !== songId));
      console.log('[Favorites] Removed:', songId);
      return true;
    } catch (err) {
      console.error('[Favorites] Remove error:', err);
      return false;
    }
  }, [isAuthenticated, user, favorites]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (song: { id: string; title: string; artist: string; coverUrl?: string }) => {
    if (isFavorite(song.id)) {
      return await removeFavorite(song.id);
    } else {
      return await addFavorite(song);
    }
  }, [favorites]);

  // Check if song is favorited
  const isFavorite = useCallback((songId: string): boolean => {
    return favorites.some(f => f.song_id === songId);
  }, [favorites]);

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    refresh: loadFavorites,
  };
}

export default useFavorites;
