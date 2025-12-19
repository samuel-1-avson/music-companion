import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Song } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  online: boolean;
  role: 'owner' | 'editor' | 'viewer';
}

export interface CollaborativePlaylist {
  id: string;
  name: string;
  description?: string;
  songs: Song[];
  collaborators: Collaborator[];
  owner_id: string;
  is_public: boolean;
  invite_code: string;
  created_at: string;
}

/**
 * useCollaborativePlaylists - Manage collaborative playlists with Supabase
 * Now with real-time updates!
 */
export function useCollaborativePlaylists() {
  const { user, isAuthenticated } = useAuth();
  const [playlists, setPlaylists] = useState<CollaborativePlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load playlists on mount or auth change
  useEffect(() => {
    if (isAuthenticated && user) {
      loadPlaylists();
    } else {
      setPlaylists([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsRealtimeConnected(false);
      }
      return;
    }

    const channel = supabase
      .channel(`collab_playlists_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_songs' },
        (payload) => {
          console.log('[Realtime] playlist_songs change:', payload.eventType);
          loadPlaylists();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collaborative_playlists' },
        (payload) => {
          console.log('[Realtime] collaborative_playlists change:', payload.eventType);
          loadPlaylists();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_collaborators' },
        (payload) => {
          console.log('[Realtime] playlist_collaborators change:', payload.eventType);
          loadPlaylists();
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsRealtimeConnected(false);
      }
    };
  }, [isAuthenticated, user?.id]);

  // Load all playlists user owns or collaborates on
  const loadPlaylists = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get playlists user owns or is a collaborator on
      const { data: ownedPlaylists, error: ownedError } = await supabase
        .from('collaborative_playlists')
        .select('*')
        .eq('owner_id', user.id);

      if (ownedError) throw ownedError;

      const { data: collabPlaylistIds, error: collabError } = await supabase
        .from('playlist_collaborators')
        .select('playlist_id')
        .eq('user_id', user.id);

      if (collabError) throw collabError;

      // Get collab playlists details
      let collabPlaylists: any[] = [];
      if (collabPlaylistIds && collabPlaylistIds.length > 0) {
        const ids = collabPlaylistIds.map(c => c.playlist_id);
        const { data, error } = await supabase
          .from('collaborative_playlists')
          .select('*')
          .in('id', ids);
        
        if (!error && data) {
          collabPlaylists = data;
        }
      }

      // Merge and dedupe
      const allPlaylists = [...(ownedPlaylists || []), ...collabPlaylists];
      const uniquePlaylists = allPlaylists.filter((p, i, arr) => 
        arr.findIndex(x => x.id === p.id) === i
      );

      // Load songs and collaborators for each playlist
      const enrichedPlaylists = await Promise.all(
        uniquePlaylists.map(async (playlist) => {
          // Get songs
          const { data: songs } = await supabase
            .from('playlist_songs')
            .select('*')
            .eq('playlist_id', playlist.id)
            .order('position');

          // Get collaborators
          const { data: collabs } = await supabase
            .from('playlist_collaborators')
            .select('user_id, role')
            .eq('playlist_id', playlist.id);

          // Get collaborator profiles
          const collaborators: Collaborator[] = [];
          if (collabs) {
            for (const c of collabs) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, avatar_url')
                .eq('id', c.user_id)
                .single();
              
              collaborators.push({
                id: c.user_id,
                name: profile?.display_name || 'User',
                avatar: profile?.avatar_url,
                online: false, // Would need realtime presence for this
                role: c.role as 'owner' | 'editor' | 'viewer',
              });
            }
          }

          // Add owner as collaborator if not already
          if (!collaborators.find(c => c.id === playlist.owner_id)) {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('id', playlist.owner_id)
              .single();
            
            collaborators.unshift({
              id: playlist.owner_id,
              name: ownerProfile?.display_name || 'Owner',
              avatar: ownerProfile?.avatar_url,
              online: playlist.owner_id === user.id,
              role: 'owner',
            });
          }

          return {
            ...playlist,
            songs: (songs || []).map((s: any) => ({
              id: s.song_id,
              title: s.title,
              artist: s.artist,
              coverUrl: s.cover_url,
            })),
            collaborators,
          };
        })
      );

      setPlaylists(enrichedPlaylists);
      console.log('[CollabPlaylists] Loaded', enrichedPlaylists.length, 'playlists');
    } catch (err: any) {
      console.error('[CollabPlaylists] Load error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Create new playlist
  const createPlaylist = useCallback(async (name: string, description?: string) => {
    if (!user) return null;

    const inviteCode = `${name.slice(0, 3).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    try {
      const { data, error } = await supabase
        .from('collaborative_playlists')
        .insert({
          name,
          description,
          owner_id: user.id,
          invite_code: inviteCode,
          is_public: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as collaborator
      await supabase.from('playlist_collaborators').insert({
        playlist_id: data.id,
        user_id: user.id,
        role: 'owner',
      });

      await loadPlaylists();
      return data;
    } catch (err: any) {
      console.error('[CollabPlaylists] Create error:', err);
      setError(err.message);
      return null;
    }
  }, [user, loadPlaylists]);

  // Join playlist by invite code
  const joinPlaylist = useCallback(async (inviteCode: string) => {
    if (!user) return false;

    try {
      // Find playlist by invite code
      const { data: playlist, error: findError } = await supabase
        .from('collaborative_playlists')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (findError || !playlist) {
        setError('Invalid invite code');
        return false;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('playlist_collaborators')
        .select('*')
        .eq('playlist_id', playlist.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        setError('Already a member');
        return false;
      }

      // Add as collaborator
      const { error: joinError } = await supabase
        .from('playlist_collaborators')
        .insert({
          playlist_id: playlist.id,
          user_id: user.id,
          role: 'editor',
        });

      if (joinError) throw joinError;

      await loadPlaylists();
      return true;
    } catch (err: any) {
      console.error('[CollabPlaylists] Join error:', err);
      setError(err.message);
      return false;
    }
  }, [user, loadPlaylists]);

  // Add song to playlist
  const addSong = useCallback(async (playlistId: string, song: Song) => {
    if (!user) return false;

    try {
      const { data: existingSongs } = await supabase
        .from('playlist_songs')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingSongs && existingSongs.length > 0 
        ? existingSongs[0].position + 1 
        : 0;

      const { error } = await supabase
        .from('playlist_songs')
        .insert({
          playlist_id: playlistId,
          song_id: song.id,
          title: song.title,
          artist: song.artist,
          cover_url: song.coverUrl,
          added_by: user.id,
          position: nextPosition,
        });

      if (error) throw error;

      await loadPlaylists();
      return true;
    } catch (err: any) {
      console.error('[CollabPlaylists] Add song error:', err);
      return false;
    }
  }, [user, loadPlaylists]);

  // Remove song from playlist
  const removeSong = useCallback(async (playlistId: string, songId: string) => {
    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistId)
        .eq('song_id', songId);

      if (error) throw error;

      await loadPlaylists();
      return true;
    } catch (err: any) {
      console.error('[CollabPlaylists] Remove song error:', err);
      return false;
    }
  }, [loadPlaylists]);

  // Delete playlist
  const deletePlaylist = useCallback(async (playlistId: string) => {
    try {
      const { error } = await supabase
        .from('collaborative_playlists')
        .delete()
        .eq('id', playlistId)
        .eq('owner_id', user?.id);

      if (error) throw error;

      await loadPlaylists();
      return true;
    } catch (err: any) {
      console.error('[CollabPlaylists] Delete error:', err);
      return false;
    }
  }, [user, loadPlaylists]);

  return {
    playlists,
    isLoading,
    error,
    isRealtimeConnected,
    createPlaylist,
    joinPlaylist,
    addSong,
    removeSong,
    deletePlaylist,
    refresh: loadPlaylists,
  };
}

export default useCollaborativePlaylists;
