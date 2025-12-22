/**
 * useIntegrations Hook
 * 
 * Manages OAuth integrations with external platforms (Spotify, Discord, Telegram, etc.)
 * Syncs with Supabase auth identities and stores additional data in user_integrations.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/apiClient';

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
  const { user, isAuthenticated, disconnectSpotify } = useAuth();
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
        // NOTE: Spotify is EXCLUDED here because Supabase won't unlink the last identity
        // Spotify integration should only come from user_integrations table
        for (const identity of authUser.identities) {
          const provider = identity.provider as Integration['provider'];
          // Only include Discord and Twitch from auth identities (not Spotify)
          if (['discord', 'twitch'].includes(provider)) {
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
          // Skip integrations that are pending verification (email_verified is false or null)
          if (item.email_verified === false || (item.metadata?.pending_verification === true)) {
            console.log(`[Integrations] Skipping ${item.provider} - pending verification`);
            continue;
          }
          
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
   * ALL providers now use backend OAuth to avoid Supabase identity conflicts
   * Tokens are stored in user_integrations table, not as Supabase identities
   */
  const connectOAuth = useCallback(async (provider: 'spotify' | 'discord' | 'twitch' | 'youtube' | 'lastfm') => {
    if (!isAuthenticated || !user) {
      console.error('[Integrations] Must be logged in to connect');
      return false;
    }

    try {
      console.log(`[Integrations] Connecting to ${provider}...`);
      const userEmail = user.email || '';

      // ALL providers use backend OAuth (stores in user_integrations table)
      // This avoids Supabase "account already linked" conflicts
      api.redirectToOAuth(provider, user.id, userEmail);
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
      const response = await api.post('/auth/verify-integration', {
        user_id: user.id,
        provider,
        code,
      });

      if (response.success) {
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
   * Uses backend endpoint to delete from user_integrations table
   * For Discord/Twitch, also attempts to unlink Supabase auth identity
   * For Spotify, only uses backend since Spotify tokens are only in user_integrations
   */
  const disconnect = useCallback(async (provider: string) => {
    if (!user) return false;

    try {
      console.log(`[Integrations] Disconnecting ${provider}...`);
      
      // OPTIMISTIC UPDATE: Remove from local state immediately for instant UI feedback
      setIntegrations(prev => prev.filter(i => i.provider !== provider));

      // Call backend disconnect endpoint to remove from user_integrations table
      const response = await api.post(`/auth/disconnect/${provider}`, {
        user_id: user.id,
      });
      
      if (!response.success) {
        console.error(`[Integrations] Disconnect ${provider} failed:`, response.error);
        // Revert state if failed (optional, but safer)
        await loadIntegrations(); 
        return false;
      }

      // For Spotify: Call AuthContext disconnect helper to clear all state
      if (provider === 'spotify') {
        try {
          disconnectSpotify();
        } catch (e) {
          console.warn('[Integrations] Could not disconnect spotify auth:', e);
        }
      }

      // For Discord/Twitch: also try to unlink from Supabase auth (if they were linked)
      if (['discord', 'twitch'].includes(provider)) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const identity = authUser?.identities?.find(i => i.provider === provider);
          
          if (identity) {
            console.log(`[Integrations] Unlinking ${provider} identity...`);
            const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
            
            if (unlinkError) {
              console.warn(`[Integrations] Could not unlink ${provider} identity:`, unlinkError.message);
            } else {
              console.log(`[Integrations] Successfully unlinked ${provider} identity`);
            }
          }
        } catch (identityError: any) {
          console.warn(`[Integrations] Identity unlink error:`, identityError.message);
        }
      }

      console.log(`[Integrations] ${provider} disconnected successfully`);
      
      // Don't call loadIntegrations() here - the optimistic update already removed it
      // Calling it again can cause a race condition where the record re-appears briefly
      return true;
    } catch (err: any) {
      console.error(`[Integrations] Disconnect ${provider} error:`, err);
      setError(err.message);
      await loadIntegrations(); // Revert on error
      return false;
    }
  }, [user, loadIntegrations]);

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
    if (!user) return;
    api.redirectToOAuth('spotify', user.id, user.email || '');
  }, [user]);

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
