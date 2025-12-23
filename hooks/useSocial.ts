/**
 * useSocial - Hook for social features (follows, activity)
 * 
 * Works with local state when not authenticated,
 * syncs with Supabase when logged in.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
}

export interface Activity {
  id: string;
  user_id: string;
  user?: UserProfile;
  action: 'played' | 'favorited' | 'created_playlist' | 'followed' | 'shared';
  content: {
    song_id?: string;
    song_title?: string;
    artist?: string;
    playlist_id?: string;
    playlist_name?: string;
    target_user_id?: string;
    target_user_name?: string;
  };
  created_at: string;
}

interface UseSocialResult {
  // Follow management
  followers: UserProfile[];
  following: UserProfile[];
  isFollowing: (userId: string) => boolean;
  follow: (userId: string) => Promise<void>;
  unfollow: (userId: string) => Promise<void>;
  
  // Activity feed
  activities: Activity[];
  loadActivities: (type?: 'all' | 'following') => Promise<void>;
  postActivity: (action: Activity['action'], content: Activity['content']) => Promise<void>;
  
  // User discovery
  suggestedUsers: UserProfile[];
  searchUsers: (query: string) => Promise<UserProfile[]>;
  
  // Loading states
  loading: boolean;
}

export function useSocial(): UseSocialResult {
  const { profile, isAuthenticated } = useAuth();
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Load follows on mount
  useEffect(() => {
    if (isAuthenticated && profile?.id) {
      loadFollows();
      loadSuggestions();
    }
  }, [isAuthenticated, profile?.id]);

  const loadFollows = async () => {
    if (!profile?.id) return;
    
    try {
      // Load followers
      const { data: followersData } = await supabase
        .from('user_follows')
        .select('follower_id, profiles!user_follows_follower_id_fkey(id, display_name, avatar_url)')
        .eq('following_id', profile.id);

      // Load following
      const { data: followingData } = await supabase
        .from('user_follows')
        .select('following_id, profiles!user_follows_following_id_fkey(id, display_name, avatar_url)')
        .eq('follower_id', profile.id);

      if (followersData) {
        setFollowers(followersData.map((f: any) => f.profiles).filter(Boolean));
      }
      if (followingData) {
        setFollowing(followingData.map((f: any) => f.profiles).filter(Boolean));
      }
    } catch (err) {
      console.error('[Social] Failed to load follows:', err);
    }
  };

  const loadSuggestions = async () => {
    if (!profile?.id) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .neq('id', profile.id)
        .limit(5);

      if (data) {
        setSuggestedUsers(data);
      }
    } catch (err) {
      console.error('[Social] Failed to load suggestions');
    }
  };

  const isFollowing = useCallback((userId: string) => {
    return following.some(u => u.id === userId);
  }, [following]);

  const follow = useCallback(async (userId: string) => {
    if (!profile?.id) return;
    
    try {
      await supabase
        .from('user_follows')
        .insert({ follower_id: profile.id, following_id: userId });

      // Optimistic update
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', userId)
        .single();

      if (userData) {
        setFollowing(prev => [...prev, userData]);
      }

      // Post activity
      await postActivity('followed', { target_user_id: userId, target_user_name: userData?.display_name });
    } catch (err) {
      console.error('[Social] Failed to follow:', err);
    }
  }, [profile?.id]);

  const unfollow = useCallback(async (userId: string) => {
    if (!profile?.id) return;
    
    try {
      await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', profile.id)
        .eq('following_id', userId);

      setFollowing(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('[Social] Failed to unfollow:', err);
    }
  }, [profile?.id]);

  const loadActivities = useCallback(async (type: 'all' | 'following' = 'all') => {
    if (!profile?.id) return;
    setLoading(true);
    
    try {
      let query = supabase
        .from('user_activity')
        .select('*, profiles!user_activity_user_id_fkey(id, display_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (type === 'following') {
        const followingIds = following.map(f => f.id);
        if (followingIds.length > 0) {
          query = query.in('user_id', followingIds);
        }
      }

      const { data } = await query;

      if (data) {
        setActivities(data.map((a: any) => ({
          ...a,
          user: a.profiles
        })));
      }
    } catch (err) {
      console.error('[Social] Failed to load activities:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, following]);

  const postActivity = useCallback(async (action: Activity['action'], content: Activity['content']) => {
    if (!profile?.id) return;
    
    try {
      await supabase
        .from('user_activity')
        .insert({
          user_id: profile.id,
          action,
          content
        });
    } catch (err) {
      console.error('[Social] Failed to post activity:', err);
    }
  }, [profile?.id]);

  const searchUsers = useCallback(async (query: string): Promise<UserProfile[]> => {
    if (!query.trim()) return [];
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .ilike('display_name', `%${query}%`)
        .limit(10);

      return data || [];
    } catch (err) {
      console.error('[Social] Search failed:', err);
      return [];
    }
  }, []);

  return {
    followers,
    following,
    isFollowing,
    follow,
    unfollow,
    activities,
    loadActivities,
    postActivity,
    suggestedUsers,
    searchUsers,
    loading,
  };
}

export default useSocial;
