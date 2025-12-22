import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { tokenManager, SpotifyTokens as TokenManagerTokens } from '../services/TokenManager';
import { integrationTokenManager } from '../services/IntegrationTokenManager';
import api from '../utils/apiClient';

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
  disconnectSpotify: () => void;
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
    let isMounted = true;
    
    // Helper to update state safely (accepts direct value or updater function)
    const safeSetState = (update: AuthState | ((prev: AuthState) => AuthState)) => {
      if (isMounted) {
        setState(update);
      }
    };
    
    // Helper to handle successful session
    const handleSession = async (session: Session, source: string) => {
      try {
        const user = session.user;
        const metadata = user.user_metadata || {};
        // Google OAuth stores user info in identities[0].identity_data
        const identityData = user.identities?.[0]?.identity_data || {};
        
        console.log(`[Auth] Session established via ${source}`, {
          email: user.email,
          id: user.id,
          metadata,
          identityData,
          identities: user.identities
        });
        
        // Fetch profile from database (may fail due to RLS or missing table)
        let profile: UserProfile | null = null;
        try {
          profile = await fetchProfile(user.id);
          console.log('[Auth] Profile from DB:', profile);
        } catch (fetchErr) {
          console.warn('[Auth] Failed to fetch profile from DB:', fetchErr);
        }
        
        // If no profile exists, create a fallback from user metadata or identity data
        if (!profile) {
          console.log('[Auth] ⚠️ No profile found, creating fallback from identity data');
          
          // Try multiple sources for display name
          const displayName = identityData.full_name 
            || identityData.name 
            || metadata.full_name 
            || metadata.name 
            || metadata.display_name 
            || user.email?.split('@')[0] 
            || identityData.email?.split('@')[0]
            || 'User';
            
          // Try multiple sources for avatar
          const avatarUrl = identityData.picture 
            || identityData.avatar_url 
            || metadata.avatar_url 
            || metadata.picture;
            
          // Try multiple sources for email
          const email = user.email || identityData.email || metadata.email || '';
          
          profile = {
            id: user.id,
            email,
            display_name: displayName,
            avatar_url: avatarUrl,
          };
          console.log('[Auth] ✅ Created fallback profile:', profile);
        }
        
        const spotifyTokens = extractSpotifyTokens(session);
        
        if (spotifyTokens) {
          tokenManager.setTokens(spotifyTokens);
        }
        
        integrationTokenManager.setUserId(user.id);
        
        console.log('[Auth] ✅ Setting authenticated state with profile:', profile?.display_name);
        
        safeSetState({
          user,
          profile,
          session,
          isAuthenticated: true,
          isLoading: false,
          spotifyTokens,
        });
      } catch (err: any) {
        console.error('[Auth] ❌ handleSession failed:', err.message || err);
        // Still try to set authenticated state with minimal profile
        safeSetState({
          user: session.user,
          profile: {
            id: session.user.id,
            email: session.user.email || '',
            display_name: 'User',
          },
          session,
          isAuthenticated: true,
          isLoading: false,
          spotifyTokens: null,
        });
      }
    };
    
    const initializeAuth = async () => {
      // Check for PKCE code in query params (OAuth callback)
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');
      const errorParam = queryParams.get('error');
      const errorDescription = queryParams.get('error_description');
      
      // Check for implicit tokens in hash (legacy flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      // Handle OAuth error in URL
      if (errorParam) {
        console.error('[Auth] OAuth error:', errorParam, errorDescription);
        window.history.replaceState(null, '', window.location.pathname);
        safeSetState(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      // Handle PKCE code exchange (Google OAuth callback)
      if (code) {
        console.log('[Auth] PKCE code detected, exchanging for session...');
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('[Auth] PKCE code exchange failed:', error.message);
            // Try to get existing session as fallback
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            if (existingSession) {
              console.log('[Auth] Found existing session after PKCE failure');
              await handleSession(existingSession, 'existing-session-fallback');
            } else {
              safeSetState(prev => ({ ...prev, isLoading: false }));
            }
          } else if (data.session) {
            await handleSession(data.session, 'PKCE-exchange');
          } else {
            console.warn('[Auth] PKCE exchange returned no session');
            safeSetState(prev => ({ ...prev, isLoading: false }));
          }
          
          // Clean up URL after processing
          window.history.replaceState(null, '', window.location.pathname);
          return;
        } catch (e: any) {
          console.error('[Auth] PKCE exchange exception:', e.message || e);
          window.history.replaceState(null, '', window.location.pathname);
          safeSetState(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }
      
      // Handle implicit flow tokens in hash (legacy)
      if (accessToken) {
        console.log('[Auth] Implicit tokens detected in URL hash');
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (error) {
            console.error('[Auth] Failed to set session from tokens:', error.message);
          } else if (data.session) {
            await handleSession(data.session, 'implicit-tokens');
          }
          
          window.history.replaceState(null, '', window.location.pathname);
          return;
        } catch (e: any) {
          console.error('[Auth] Error setting session:', e.message || e);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
      
      // Normal session check (page load without OAuth callback)
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] getSession error:', error.message);
          safeSetState(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        console.log('[Auth] Session check:', session ? `Found (${session.user.email})` : 'None');
        
        if (session?.user) {
          await handleSession(session, 'stored-session');
        } else {
          safeSetState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (e: any) {
        console.error('[Auth] Session check error:', e.message || e);
        safeSetState(prev => ({ ...prev, isLoading: false }));
      }
    };
    
    // Set up auth state listener FIRST (before any async operations)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State changed:', event, session ? `user: ${session.user.email}` : 'no session');
      
      if (!isMounted) return;
      
      if (event === 'SIGNED_IN' && session) {
        await handleSession(session, `auth-state-change-${event}`);
      } else if (event === 'SIGNED_OUT') {
        safeSetState({
          user: null,
          profile: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          spotifyTokens: null,
        });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Update session without full re-fetch
        setState(prev => ({
          ...prev,
          session,
          spotifyTokens: extractSpotifyTokens(session) || prev.spotifyTokens,
        }));
      }
    });
    
    // Then initialize
    initializeAuth();
    
    return () => {
      isMounted = false;
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
    
    // Clear token managers
    tokenManager.clear();
    integrationTokenManager.setUserId(null);
    
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
  
  // Disconnect Spotify helper (clears state and storage)
  const disconnectSpotify = useCallback(() => {
    tokenManager.clear();
    localStorage.removeItem('spotify_tokens'); // Redundant if tokenManager does it, but safety first
    setState(prev => ({ ...prev, spotifyTokens: null }));
    console.log('[Auth] Spotify disconnected and state cleared');
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
      disconnectSpotify,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
