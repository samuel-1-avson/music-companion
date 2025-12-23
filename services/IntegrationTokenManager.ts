/**
 * IntegrationTokenManager - Multi-Provider Token Management
 * 
 * Extends the Spotify TokenManager pattern to support all OAuth providers.
 * Handles proactive token refresh for Discord, YouTube, and other integrations.
 */

import { supabase } from '../utils/supabase';
import api from '../utils/apiClient';

export type OAuthProvider = 'spotify' | 'discord' | 'youtube' | 'lastfm';

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: OAuthProvider;
}

type TokenEventType = 'TOKEN_UPDATED' | 'TOKEN_EXPIRED' | 'REFRESH_FAILED';
type TokenListener = (provider: OAuthProvider, event: TokenEventType) => void;

// Refresh margin - refresh 5 minutes before expiry
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_BASE_MS = 1000;

// Refresh endpoints by provider (user-ID based - fetch token from DB server-side)
const REFRESH_ENDPOINTS: Record<OAuthProvider, string> = {
  spotify: '/auth/spotify/refresh-by-user',
  discord: '/auth/discord/refresh-by-user',
  youtube: '/auth/youtube/refresh-by-user',
  lastfm: '', // Last.fm uses session keys, no refresh needed
};

class IntegrationTokenManagerClass {
  private tokens: Map<OAuthProvider, ProviderTokens> = new Map();
  private refreshPromises: Map<OAuthProvider, Promise<ProviderTokens | null>> = new Map();
  private refreshTimers: Map<OAuthProvider, number> = new Map();
  private failureCounts: Map<OAuthProvider, number> = new Map(); // Track consecutive failures
  private listeners: Set<TokenListener> = new Set();
  private userId: string | null = null;

  /**
   * Initialize with user ID to enable automatic token loading
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
    if (userId) {
      this.loadTokensFromDatabase();
    } else {
      this.clearAll();
    }
  }

  /**
   * Load tokens from Supabase user_integrations table
   */
  async loadTokensFromDatabase(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('provider, access_token, refresh_token, token_expires_at, tokens_encrypted')
        .eq('user_id', this.userId);

      if (error) {
        console.error('[IntegrationTokenManager] Error loading tokens:', error);
        return;
      }

      for (const row of data || []) {
        const provider = row.provider as OAuthProvider;
        
        // Skip providers without refresh endpoints
        if (!REFRESH_ENDPOINTS[provider]) continue;

        // Note: If tokens are encrypted, they need decryption on the backend
        // For now, we just track expiry and trigger refresh via backend
        if (row.token_expires_at) {
          const expiresAt = new Date(row.token_expires_at).getTime();
          
          this.tokens.set(provider, {
            accessToken: '[encrypted]', // Placeholder - actual token used via backend
            refreshToken: '[encrypted]',
            expiresAt,
            provider,
          });

          // Schedule proactive refresh
          this.scheduleRefresh(provider, expiresAt);
        }
      }

      console.log(`[IntegrationTokenManager] Loaded ${this.tokens.size} provider tokens`);
    } catch (error) {
      console.error('[IntegrationTokenManager] Load error:', error);
    }
  }

  /**
   * Schedule proactive token refresh before expiry
   */
  private scheduleRefresh(provider: OAuthProvider, expiresAt: number): void {
    // Clear existing timer
    const existingTimer = this.refreshTimers.get(provider);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timeUntilRefresh = expiresAt - REFRESH_MARGIN_MS - Date.now();

    if (timeUntilRefresh <= 0) {
      // Token already needs refresh
      console.log(`[IntegrationTokenManager] ${provider} token needs immediate refresh`);
      this.refreshToken(provider);
      return;
    }

    console.log(`[IntegrationTokenManager] Scheduling ${provider} refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);

    const timer = window.setTimeout(() => {
      console.log(`[IntegrationTokenManager] Proactive refresh for ${provider}`);
      this.refreshToken(provider);
    }, timeUntilRefresh);

    this.refreshTimers.set(provider, timer);
  }

  /**
   * Refresh token for a specific provider
   */
  async refreshToken(provider: OAuthProvider): Promise<ProviderTokens | null> {
    const endpoint = REFRESH_ENDPOINTS[provider];
    if (!endpoint) {
      console.warn(`[IntegrationTokenManager] No refresh endpoint for ${provider}`);
      return null;
    }

    // Deduplication: if already refreshing, return existing promise
    const existingPromise = this.refreshPromises.get(provider);
    if (existingPromise) {
      console.log(`[IntegrationTokenManager] ${provider} refresh already in progress`);
      return existingPromise;
    }

    const refreshPromise = this.doRefresh(provider, endpoint);
    this.refreshPromises.set(provider, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshPromises.delete(provider);
    }
  }

  /**
   * Perform the actual token refresh via backend with retry logic
   */
  private async doRefresh(provider: OAuthProvider, endpoint: string, attempt: number = 1): Promise<ProviderTokens | null> {
    if (!this.userId) {
      console.warn(`[IntegrationTokenManager] No user ID for ${provider} refresh`);
      return null;
    }

    try {
      console.log(`[IntegrationTokenManager] Refreshing ${provider} token (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})...`);

      // Backend handles decryption and makes the refresh call
      const response = await api.post(`${endpoint}`, {
        user_id: this.userId,
      });

      if (!response.success) {
        throw new Error(response.error || 'Refresh failed');
      }

      // Reset failure count on success
      this.failureCounts.set(provider, 0);

      // Update expiry tracking
      const expiresIn = response.data?.expires_in || 3600;
      const expiresAt = Date.now() + (expiresIn * 1000);

      const tokens: ProviderTokens = {
        accessToken: '[refreshed]',
        expiresAt,
        provider,
      };

      this.tokens.set(provider, tokens);
      this.scheduleRefresh(provider, expiresAt);
      this.emit(provider, 'TOKEN_UPDATED');

      console.log(`[IntegrationTokenManager] ${provider} token refreshed successfully`);
      return tokens;

    } catch (error: any) {
      console.error(`[IntegrationTokenManager] ${provider} refresh failed (attempt ${attempt}):`, error.message);
      
      // Retry with exponential backoff
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
        console.log(`[IntegrationTokenManager] Retrying ${provider} refresh in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.doRefresh(provider, endpoint, attempt + 1);
      }
      
      // All retries exhausted - track failure count
      const currentFailures = (this.failureCounts.get(provider) || 0) + 1;
      this.failureCounts.set(provider, currentFailures);
      
      console.error(`[IntegrationTokenManager] ${provider} refresh failed after ${MAX_RETRY_ATTEMPTS} attempts (consecutive failures: ${currentFailures})`);
      
      // If too many consecutive refresh failures, clear the token to prevent loops
      if (currentFailures >= 3) {
        console.warn(`[IntegrationTokenManager] Too many failures for ${provider}, clearing token`);
        this.clear(provider);
      }
      
      this.emit(provider, 'REFRESH_FAILED');
      return null;
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(provider: OAuthProvider, event: TokenEventType): void {
    this.listeners.forEach(listener => {
      try {
        listener(provider, event);
      } catch (error) {
        console.error('[IntegrationTokenManager] Listener error:', error);
      }
    });
  }

  /**
   * Check if a provider's token is expiring soon
   */
  isExpiringSoon(provider: OAuthProvider): boolean {
    const tokens = this.tokens.get(provider);
    if (!tokens?.expiresAt) return false;
    return Date.now() >= (tokens.expiresAt - REFRESH_MARGIN_MS);
  }

  /**
   * Subscribe to token events
   */
  subscribe(listener: TokenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all tokens and timers
   */
  clearAll(): void {
    this.refreshTimers.forEach((timer) => clearTimeout(timer));
    this.refreshTimers.clear();
    this.tokens.clear();
    this.refreshPromises.clear();
  }

  /**
   * Clear tokens for a specific provider
   */
  clear(provider: OAuthProvider): void {
    const timer = this.refreshTimers.get(provider);
    if (timer) clearTimeout(timer);
    this.refreshTimers.delete(provider);
    this.tokens.delete(provider);
    this.refreshPromises.delete(provider);
    this.failureCounts.delete(provider);
  }
}

// Export singleton
export const integrationTokenManager = new IntegrationTokenManagerClass();

export default integrationTokenManager;
