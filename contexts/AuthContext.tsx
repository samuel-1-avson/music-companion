import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { tokenManager, SpotifyTokens as TokenManagerTokens } from '../services/TokenManager';

// User profile type
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at?: string;
}

// Spotify tokens from OAuth
export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Auth state
interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Spotify OAuth tokens (extracted from session when Spotify is connected)
  spotifyTokens: SpotifyTokens | null;
}

// Auth context type
interface AuthContextType extends AuthState {
  // Email auth
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  
  // Profile
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  
  // OAuth (optional)
  signInWithGoogle: () => Promise<void>;
  signInWithSpotify: () => Promise<void>;
  
  // Password reset
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  
  // Spotify helpers
  hasSpotifyAccess: boolean;
  refreshSpotifyToken: () => Promise<SpotifyTokens | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Provider
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Extract Spotify tokens from Supabase session
 * When user connects via Supabase OAuth, provider_token contains the Spotify access token
 * NOTE: Supabase does NOT refresh provider tokens - they expire after 1 hour
 */
function extractSpotifyTokens(session: Session | null): SpotifyTokens | null {
  if (!session) return null;
  
  // Check if user has Spotify identity
  const spotifyIdentity = session.user?.identities?.find(
    i => i.provider === 'spotify'
  );
  
  if (!spotifyIdentity) return null;
  
  // Provider token is the Spotify access token
  if (session.provider_token) {
    // Check if token is expired (Spotify tokens last 1 hour)
    // session.expires_at is in seconds, we need milliseconds
    const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
    const now = Date.now();
    
    if (expiresAt && now > expiresAt) {
      console.warn('[Auth] Spotify token is expired, not extracting');
      return null;
    }
    
    console.log('[Auth] Found Spotify OAuth token from session');
    return {
      accessToken: session.provider_token,
      refreshToken: session.provider_refresh_token || undefined,
      expiresAt,
    };
  }
  
  return null;
}


export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    spotifyTokens: null,
  });

  // Fetch user profile from profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('[Auth] Error fetching profile:', error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const spotifyTokens = extractSpotifyTokens(session);
        
        // Sync to TokenManager for proactive refresh
        if (spotifyTokens) {
          tokenManager.setTokens(spotifyTokens);
          console.log('[Auth] Spotify connected via OAuth, synced to TokenManager');
        }
        
        setState({
          user: session.user,
          profile,
          session,
          isAuthenticated: true,
          isLoading: false,
          spotifyTokens,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State changed:', event);
      
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const spotifyTokens = extractSpotifyTokens(session);
        
        // Sync to TokenManager for proactive refresh
        if (spotifyTokens) {
          tokenManager.setTokens(spotifyTokens);
          console.log('[Auth] Spotify tokens updated, synced to TokenManager');
        }
        
        setState({
          user: session.user,
          profile,
          session,
          isAuthenticated: true,
          isLoading: false,
          spotifyTokens,
        });
      } else {
        setState({
          user: null,
          profile: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          spotifyTokens: null,
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign up with email
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0]
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        return { success: true };
      }

      return { success: true, error: 'Please check your email to confirm your account' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Sign up failed' };
    }
  }, []);

  // Sign in with email
  const signIn = useCallback(async (
    email: string, 
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Sign in failed' };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    // Clear Supabase session
    await supabase.auth.signOut();
    
    // Clear all localStorage items that might persist session
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expiry');
    localStorage.removeItem('music_companion_guest_favorites');
    localStorage.removeItem('music_companion_guest_history');
    localStorage.removeItem('music_companion_guest_preferences');
    
    // Force state reset to ensure UI updates
    setState({
      user: null,
      profile: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      spotifyTokens: null,
    });
  }, []);

  // Password reset
  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Password reset failed' };
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!state.user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', state.user.id);

      if (error) {
        console.error('[Auth] Error updating profile:', error);
        return false;
      }

      // Refresh profile
      const profile = await fetchProfile(state.user.id);
      setState(prev => ({ ...prev, profile }));
      return true;
    } catch (error) {
      console.error('[Auth] Error updating profile:', error);
      return false;
    }
  }, [state.user, fetchProfile]);

  // OAuth: Google
  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
  }, []);

  // OAuth: Spotify (with data access scopes)
  const signInWithSpotify = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        redirectTo: window.location.origin,
        scopes: 'user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played user-top-read playlist-read-private playlist-modify-private streaming',
        queryParams: {
          show_dialog: 'true' // Always show account selection
        }
      }
    });
  }, []);

  // Refresh Spotify token (uses TokenManager with deduplication)
  const refreshSpotifyToken = useCallback(async (): Promise<SpotifyTokens | null> => {
    try {
      // Use TokenManager for refresh with deduplication and retry logic
      const tokens = await tokenManager.refreshToken();
      
      if (tokens) {
        setState(prev => ({ ...prev, spotifyTokens: tokens }));
        console.log('[Auth] Token refresh successful via TokenManager');
        return tokens;
      }
      
      // Fallback to Supabase session refresh if TokenManager fails
      console.log('[Auth] Falling back to Supabase session refresh');
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('[Auth] Error refreshing session:', error);
        return null;
      }
      
      const sessionTokens = extractSpotifyTokens(session);
      if (sessionTokens) {
        tokenManager.setTokens(sessionTokens);
        setState(prev => ({ ...prev, spotifyTokens: sessionTokens, session }));
      }
      return sessionTokens;
    } catch (error) {
      console.error('[Auth] Error refreshing Spotify token:', error);
      return null;
    }
  }, []);

  // Check if we have valid Spotify access
  const hasSpotifyAccess = !!state.spotifyTokens?.accessToken;

  return (
    <AuthContext.Provider value={{
      ...state,
      signUp,
      signIn,
      signOut,
      updateProfile,
      signInWithGoogle,
      signInWithSpotify,
      resetPassword,
      hasSpotifyAccess,
      refreshSpotifyToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
