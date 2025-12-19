/**
 * TokenManager - Centralized Spotify Token Management
 * 
 * Handles:
 * - Token storage and retrieval
 * - Refresh deduplication (prevents concurrent refresh calls)
 * - Proactive refresh (refreshes before expiry)
 * - Event-based token updates
 */

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

type TokenEventType = 'TOKEN_UPDATED' | 'TOKEN_EXPIRED' | 'REFRESH_FAILED';
type TokenListener = (event: TokenEventType, tokens: SpotifyTokens | null) => void;

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'spotify_access_token',
  REFRESH_TOKEN: 'spotify_refresh_token',
  EXPIRES_AT: 'spotify_token_expiry',
} as const;

// Backend API URL for token refresh
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Refresh margin - refresh 5 minutes before expiry
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Maximum retry attempts
const MAX_RETRY_ATTEMPTS = 3;

// Retry delay base (exponential backoff)
const RETRY_DELAY_BASE_MS = 1000;

/**
 * TokenManager Singleton
 * 
 * Usage:
 * ```ts
 * const token = await tokenManager.getValidToken();
 * 
 * // Listen for token changes
 * tokenManager.subscribe((event, tokens) => {
 *   if (event === 'TOKEN_UPDATED') updateUI(tokens);
 * });
 * ```
 */
class TokenManagerClass {
  private tokens: SpotifyTokens | null = null;
  private refreshPromise: Promise<SpotifyTokens | null> | null = null;
  private listeners: Set<TokenListener> = new Set();
  private refreshTimer: number | null = null;
  private isRefreshing = false;

  constructor() {
    // Load tokens from storage on initialization
    this.loadFromStorage();
  }

  /**
   * Load tokens from localStorage
   */
  private loadFromStorage(): void {
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const expiresAtStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);

      if (accessToken) {
        this.tokens = {
          accessToken,
          refreshToken: refreshToken || undefined,
          expiresAt: expiresAtStr ? parseInt(expiresAtStr, 10) : undefined,
        };
        
        // Schedule proactive refresh if we have expiry time
        if (this.tokens.expiresAt) {
          this.scheduleProactiveRefresh();
        }
        
        console.log('[TokenManager] Loaded tokens from storage');
      }
    } catch (error) {
      console.error('[TokenManager] Error loading from storage:', error);
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveToStorage(tokens: SpotifyTokens): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
      
      if (tokens.refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
      }
      
      if (tokens.expiresAt) {
        localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, tokens.expiresAt.toString());
      }
    } catch (error) {
      console.error('[TokenManager] Error saving to storage:', error);
    }
  }

  /**
   * Clear tokens from storage
   */
  private clearStorage(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  }

  /**
   * Check if token is expired or expiring soon
   */
  private isTokenExpired(): boolean {
    if (!this.tokens?.expiresAt) return false;
    return Date.now() >= this.tokens.expiresAt;
  }

  /**
   * Check if token will expire within the refresh margin
   */
  private isTokenExpiringSoon(): boolean {
    if (!this.tokens?.expiresAt) return false;
    return Date.now() >= (this.tokens.expiresAt - REFRESH_MARGIN_MS);
  }

  /**
   * Schedule proactive token refresh before expiry
   */
  private scheduleProactiveRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.tokens?.expiresAt) return;

    const timeUntilRefresh = this.tokens.expiresAt - REFRESH_MARGIN_MS - Date.now();
    
    if (timeUntilRefresh <= 0) {
      // Token already needs refresh
      console.log('[TokenManager] Token needs immediate refresh');
      this.refreshToken();
      return;
    }

    console.log(`[TokenManager] Scheduling proactive refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    
    this.refreshTimer = window.setTimeout(() => {
      console.log('[TokenManager] Proactive refresh triggered');
      this.refreshToken();
    }, timeUntilRefresh);
  }

  /**
   * Notify all subscribers of token events
   */
  private emit(event: TokenEventType): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, this.tokens);
      } catch (error) {
        console.error('[TokenManager] Listener error:', error);
      }
    });
  }

  /**
   * Perform token refresh with backend
   * Returns null if refresh fails after all retries
   */
  private async doRefresh(attempt: number = 1): Promise<SpotifyTokens | null> {
    const refreshToken = this.tokens?.refreshToken;
    
    if (!refreshToken) {
      console.warn('[TokenManager] No refresh token available');
      this.emit('REFRESH_FAILED');
      return null;
    }

    try {
      console.log(`[TokenManager] Refreshing token (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`);
      
      const response = await fetch(`${BACKEND_URL}/auth/spotify/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      // Calculate expiry time
      const expiresIn = data.expires_in || 3600; // Default 1 hour
      const expiresAt = Date.now() + (expiresIn * 1000);

      const newTokens: SpotifyTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Keep old if not provided
        expiresAt,
      };

      // Update internal state
      this.tokens = newTokens;
      this.saveToStorage(newTokens);
      
      // Schedule next proactive refresh
      this.scheduleProactiveRefresh();
      
      console.log('[TokenManager] Token refreshed successfully');
      this.emit('TOKEN_UPDATED');
      
      return newTokens;

    } catch (error: any) {
      console.error(`[TokenManager] Refresh failed (attempt ${attempt}):`, error.message);
      
      // Retry with exponential backoff
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
        console.log(`[TokenManager] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.doRefresh(attempt + 1);
      }
      
      // All retries exhausted
      console.error('[TokenManager] All refresh attempts failed');
      this.emit('REFRESH_FAILED');
      return null;
    }
  }

  // ============= PUBLIC API =============

  /**
   * Get a valid access token, refreshing if necessary
   * Returns null if no token available or refresh fails
   */
  async getValidToken(): Promise<string | null> {
    // No tokens at all
    if (!this.tokens?.accessToken) {
      return null;
    }

    // Token is still valid (not expired or expiring soon)
    if (!this.isTokenExpired() && !this.isTokenExpiringSoon()) {
      return this.tokens.accessToken;
    }

    // Need to refresh - use deduplication
    const refreshed = await this.refreshToken();
    return refreshed?.accessToken || null;
  }

  /**
   * Refresh the token (with deduplication)
   * Multiple concurrent calls will share the same refresh request
   */
  async refreshToken(): Promise<SpotifyTokens | null> {
    // If already refreshing, return the existing promise
    if (this.refreshPromise) {
      console.log('[TokenManager] Refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    // Mark as refreshing and create promise
    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh()
      .finally(() => {
        this.isRefreshing = false;
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  /**
   * Set tokens (e.g., after OAuth callback)
   */
  setTokens(tokens: SpotifyTokens): void {
    this.tokens = tokens;
    this.saveToStorage(tokens);
    this.scheduleProactiveRefresh();
    this.emit('TOKEN_UPDATED');
    console.log('[TokenManager] Tokens set');
  }

  /**
   * Get current tokens (may be expired)
   */
  getTokens(): SpotifyTokens | null {
    return this.tokens;
  }

  /**
   * Check if tokens exist (may be expired)
   */
  hasTokens(): boolean {
    return !!this.tokens?.accessToken;
  }

  /**
   * Check if a refresh is currently in progress
   */
  isRefreshInProgress(): boolean {
    return this.isRefreshing;
  }

  /**
   * Clear all tokens (logout)
   */
  clear(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.tokens = null;
    this.refreshPromise = null;
    this.isRefreshing = false;
    this.clearStorage();
    this.emit('TOKEN_EXPIRED');
    console.log('[TokenManager] Tokens cleared');
  }

  /**
   * Subscribe to token events
   */
  subscribe(listener: TokenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get time until token expires (in ms)
   * Returns -1 if no expiry info or already expired
   */
  getTimeUntilExpiry(): number {
    if (!this.tokens?.expiresAt) return -1;
    const remaining = this.tokens.expiresAt - Date.now();
    return remaining > 0 ? remaining : -1;
  }
}

// Export singleton instance
export const tokenManager = new TokenManagerClass();

// Also export the class for testing
export { TokenManagerClass };
