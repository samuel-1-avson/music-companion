/**
 * useIntegrations Hook
 * 
 * Manages OAuth integrations with external platforms (Spotify, Discord, Telegram, etc.)
 * Syncs with Supabase auth identities and stores additional data in user_integrations.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Integration {
  id: string;
  provider: 'spotify' | 'discord' | 'lastfm' | 'telegram' | 'twitch' | 'youtube';
  provider_user_id?: string;
  provider_username?: string;
  provider_avatar_url?: string;
  metadata: Record<string, any>;
  connected_at: string;
  is_connected: boolean;
}

export function useIntegrations() {
  const { user, isAuthenticated } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load integrations from Supabase auth identities and user_integrations table
   */
  const loadIntegrations = useCallback(async () => {
    if (!user) {
      setIntegrations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allIntegrations: Integration[] = [];

      // 1. Check user's linked identities from Supabase auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('[Integrations] Auth error:', authError);
      } else if (authUser?.identities) {
        // Map Supabase identities to our format
        for (const identity of authUser.identities) {
          const provider = identity.provider as Integration['provider'];
          if (['spotify', 'discord', 'twitch'].includes(provider)) {
            allIntegrations.push({
              id: identity.id,
              provider,
              provider_user_id: identity.identity_data?.sub || identity.identity_data?.id,
              provider_username: identity.identity_data?.name || 
                                 identity.identity_data?.full_name ||
                                 identity.identity_data?.preferred_username ||
                                 identity.identity_data?.email?.split('@')[0],
              provider_avatar_url: identity.identity_data?.avatar_url || 
                                   identity.identity_data?.picture,
              metadata: identity.identity_data || {},
              connected_at: identity.created_at || new Date().toISOString(),
              is_connected: true,
            });
          }
        }
      }

      // 2. Load additional integrations from user_integrations table (Telegram, YouTube, Last.fm, etc.)
      const { data: customIntegrations, error: fetchError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) {
        console.warn('[Integrations] Custom table error:', fetchError.message);
      } else if (customIntegrations) {
        for (const item of customIntegrations) {
          // Only add if not already in OAuth identities
          if (!allIntegrations.find(i => i.provider === item.provider)) {
            allIntegrations.push({
              id: item.id,
              provider: item.provider,
              provider_user_id: item.provider_user_id,
              provider_username: item.provider_username,
              provider_avatar_url: item.provider_avatar_url,
              metadata: item.metadata || {},
              connected_at: item.connected_at || item.created_at,
              is_connected: true,
            });
          }
        }
      }

      setIntegrations(allIntegrations);
    } catch (err: any) {
      console.error('[Integrations] Load error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load integrations on mount and when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadIntegrations();
    } else {
      setIntegrations([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user, loadIntegrations]);

  /**
   * Connect to a provider using OAuth
   * - Spotify uses Supabase OAuth with linkIdentity (for existing users)
   * - Discord/YouTube use backend OAuth
   */
  const connectOAuth = useCallback(async (provider: 'spotify' | 'discord' | 'twitch' | 'youtube' | 'lastfm') => {
    if (!isAuthenticated || !user) {
      console.error('[Integrations] Must be logged in to connect');
      return false;
    }

    try {
      console.log(`[Integrations] Connecting to ${provider}...`);
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // Spotify uses Supabase linkIdentity (links to existing account)
      if (provider === 'spotify') {
        const { error } = await supabase.auth.linkIdentity({
          provider: 'spotify',
          options: {
            redirectTo: `${window.location.origin}/integrations?spotify_connected=true`,
            scopes: 'user-read-email user-read-private user-library-read user-library-modify streaming user-read-playback-state user-modify-playback-state user-read-recently-played playlist-read-private playlist-modify-public playlist-modify-private',
          },
        });
        if (error) throw error;
        return true;
      }

      // Last.fm specific flow
      if (provider === 'lastfm') {
        window.location.href = `${backendUrl}/auth/lastfm?user_id=${user.id}`;
        return true;
      }

      // Other providers use backend OAuth
      const userEmail = user.email || '';
      window.location.href = `${backendUrl}/auth/${provider}?user_id=${user.id}&user_email=${encodeURIComponent(userEmail)}`;
      return true;
    } catch (err: any) {
      console.error(`[Integrations] ${provider} connect error:`, err);
      setError(err.message);
      return false;
    }
  }, [isAuthenticated, user]);

  /**
   * Verify integration with email code
   */
  const verifyIntegration = useCallback(async (provider: string, code: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/auth/verify-integration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, provider, code }),
      });

      const data = await response.json();
      if (data.success) {
        console.log(`[Integrations] ${provider} verified successfully`);
        await loadIntegrations(); // Reload integrations
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(`[Integrations] Verification error:`, err);
      return false;
    }
  }, [user, loadIntegrations]);

  /**
   * Disconnect a provider
   * For OAuth providers, uses Supabase unlinkIdentity
   */
  const disconnect = useCallback(async (provider: string) => {
    if (!user) return false;

    try {
      // For OAuth providers (Spotify, Discord, Twitch), unlink from Supabase auth
      if (['spotify', 'discord', 'twitch'].includes(provider)) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const identity = authUser?.identities?.find(i => i.provider === provider);
        
        if (identity) {
          console.log(`[Integrations] Unlinking ${provider} identity:`, identity.id);
          const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
          
          if (unlinkError) {
            console.error(`[Integrations] Unlink ${provider} error:`, unlinkError);
          } else {
            console.log(`[Integrations] Successfully unlinked ${provider}`);
          }
        }
      }

      // Also remove from user_integrations table (for Telegram, Last.fm, etc.)
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);

      if (error) {
        console.warn('[Integrations] Custom table delete error:', error.message);
      }

      // Remove from local state
      setIntegrations(prev => prev.filter(i => i.provider !== provider));
      console.log(`[Integrations] ${provider} disconnected`);
      
      // Reload to refresh state
      if (['spotify', 'discord', 'twitch'].includes(provider)) {
        setTimeout(() => window.location.reload(), 500);
      }
      
      return true;
    } catch (err: any) {
      console.error(`[Integrations] Disconnect ${provider} error:`, err);
      setError(err.message);
      return false;
    }
  }, [user]);

  /**
   * Get integration by provider
   */
  const getIntegration = useCallback((provider: string): Integration | undefined => {
    return integrations.find(i => i.provider === provider);
  }, [integrations]);

  /**
   * Check if provider is connected
   */
  const isConnected = useCallback((provider: string): boolean => {
    return integrations.some(i => i.provider === provider);
  }, [integrations]);

  /**
   * Store Telegram bot configuration
   */
  const connectTelegram = useCallback(async (chatId: string, username?: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          provider: 'telegram',
          provider_user_id: chatId,
          provider_username: username || `Chat ${chatId}`,
          metadata: { chat_id: chatId },
        }, {
          onConflict: 'user_id,provider',
        });

      if (error) throw error;

      await loadIntegrations();
      console.log('[Integrations] Telegram connected');
      return true;
    } catch (err: any) {
      console.error('[Integrations] Telegram error:', err);
      setError(err.message);
      return false;
    }
  }, [user, loadIntegrations]);

  /**
   * Connect Spotify using backend OAuth flow (for playback control)
   */
  const connectSpotifyPlayback = useCallback(async () => {
    window.location.href = 'http://localhost:3001/auth/spotify';
  }, []);

  return {
    integrations,
    isLoading,
    error,
    connectOAuth,
    connectSpotifyPlayback,
    connectTelegram,
    disconnect,
    getIntegration,
    isConnected,
    verifyIntegration,
    refresh: loadIntegrations,
  };
}

export default useIntegrations;
