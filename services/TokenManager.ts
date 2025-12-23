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

type TokenEventType = 'TOKEN_UPDATED' | 'TOKEN_EXPIRED' | 'REFRESH_FAILED' | 'CIRCUIT_OPEN' | 'CIRCUIT_CLOSED';
type TokenListener = (event: TokenEventType, tokens: SpotifyTokens | null) => void;

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'spotify_access_token',
  REFRESH_TOKEN: 'spotify_refresh_token',
  EXPIRES_AT: 'spotify_token_expiry',
} as const;

// Use shared API client for backend URL
import { getBackendUrl } from '../utils/apiClient';

// Refresh margin - refresh 5 minutes before expiry
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// Maximum retry attempts
const MAX_RETRY_ATTEMPTS = 3;

// Retry delay base (exponential backoff)
const RETRY_DELAY_BASE_MS = 1000;

// Circuit breaker configuration
const CIRCUIT_FAILURE_THRESHOLD = 5; // Open circuit after 5 consecutive failures
const CIRCUIT_RESET_TIMEOUT_MS = 10 * 60 * 1000; // Reset after 10 minutes

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
  
  // Circuit breaker state
  private consecutiveFailures = 0;
  private circuitOpen = false;
  private circuitOpenedAt = 0;

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
   * Check if circuit breaker should allow refresh attempt
   */
  private checkCircuitBreaker(): boolean {
    // If circuit is open, check if it should be reset
    if (this.circuitOpen) {
      const timeSinceOpened = Date.now() - this.circuitOpenedAt;
      if (timeSinceOpened >= CIRCUIT_RESET_TIMEOUT_MS) {
        console.log('[TokenManager] Circuit breaker reset (timeout elapsed)');
        this.circuitOpen = false;
        this.consecutiveFailures = 0;
        this.emit('CIRCUIT_CLOSED');
        return true;
      }
      console.warn('[TokenManager] Circuit breaker OPEN - blocking refresh attempt');
      return false;
    }
    return true;
  }

  /**
   * Perform token refresh with backend
   * Returns null if refresh fails after all retries
   */
  private async doRefresh(attempt: number = 1): Promise<SpotifyTokens | null> {
    // Check circuit breaker on first attempt
    if (attempt === 1 && !this.checkCircuitBreaker()) {
      this.emit('REFRESH_FAILED');
      return null;
    }
    
    const refreshToken = this.tokens?.refreshToken;
    
    if (!refreshToken) {
      console.warn('[TokenManager] No refresh token available');
      this.emit('REFRESH_FAILED');
      return null;
    }

    try {
      console.log(`[TokenManager] Refreshing token (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`);
      
      const response = await fetch(`${getBackendUrl()}/auth/spotify/refresh`, {
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
      
      // Reset circuit breaker on success
      this.consecutiveFailures = 0;
      if (this.circuitOpen) {
        this.circuitOpen = false;
        this.emit('CIRCUIT_CLOSED');
      }
      
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
      
      // All retries exhausted - update circuit breaker
      this.consecutiveFailures++;
      console.error(`[TokenManager] All refresh attempts failed (consecutive failures: ${this.consecutiveFailures})`);
      
      // Check if we should open the circuit
      if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD && !this.circuitOpen) {
        this.circuitOpen = true;
        this.circuitOpenedAt = Date.now();
        console.error(`[TokenManager] Circuit breaker OPENED after ${this.consecutiveFailures} failures`);
        this.emit('CIRCUIT_OPEN');
      }
      
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
   * Check if circuit breaker is currently open
   */
  isCircuitOpen(): boolean {
    // Check if circuit should be reset due to timeout
    if (this.circuitOpen) {
      const timeSinceOpened = Date.now() - this.circuitOpenedAt;
      if (timeSinceOpened >= CIRCUIT_RESET_TIMEOUT_MS) {
        this.circuitOpen = false;
        this.consecutiveFailures = 0;
        return false;
      }
    }
    return this.circuitOpen;
  }

  /**
   * Manually reset the circuit breaker
   */
  resetCircuitBreaker(): void {
    if (this.circuitOpen) {
      console.log('[TokenManager] Circuit breaker manually reset');
      this.circuitOpen = false;
      this.consecutiveFailures = 0;
      this.emit('CIRCUIT_CLOSED');
    }
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
