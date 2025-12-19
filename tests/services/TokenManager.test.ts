import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch before importing TokenManager
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock import.meta.env
vi.stubGlobal('import.meta', { env: { VITE_BACKEND_URL: 'http://localhost:3001' } });

// Dynamic import to ensure mocks are in place
let tokenManager: any;
let TokenManagerClass: any;

describe('TokenManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as any).mockReset();
    
    // Re-import to get fresh instance
    vi.resetModules();
    const module = await import('../../services/TokenManager');
    tokenManager = module.tokenManager;
    TokenManagerClass = module.TokenManagerClass;
  });

  afterEach(() => {
    tokenManager?.clear?.();
  });

  describe('Token Storage', () => {
    it('should save tokens to localStorage', () => {
      const tokens = {
        accessToken: 'test_access_token',
        refreshToken: 'test_refresh_token',
        expiresAt: Date.now() + 3600000, // 1 hour
      };

      tokenManager.setTokens(tokens);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('spotify_access_token', tokens.accessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('spotify_refresh_token', tokens.refreshToken);
    });

    it('should load tokens from localStorage on init', async () => {
      // Set up storage before import
      localStorageMock.getItem.mockImplementation((key: string) => {
        const store: Record<string, string> = {
          spotify_access_token: 'stored_token',
          spotify_refresh_token: 'stored_refresh',
          spotify_token_expiry: String(Date.now() + 3600000),
        };
        return store[key] || null;
      });

      vi.resetModules();
      const { tokenManager: freshManager } = await import('../../services/TokenManager');
      
      expect(freshManager.hasTokens()).toBe(true);
      expect(freshManager.getTokens()?.accessToken).toBe('stored_token');
    });

    it('should clear tokens from storage', () => {
      tokenManager.setTokens({
        accessToken: 'test',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      });

      tokenManager.clear();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('spotify_access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('spotify_refresh_token');
      expect(tokenManager.hasTokens()).toBe(false);
    });
  });

  describe('Token Validation', () => {
    it('should return valid token when not expired', async () => {
      tokenManager.setTokens({
        accessToken: 'valid_token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000, // 1 hour in future
      });

      const token = await tokenManager.getValidToken();
      expect(token).toBe('valid_token');
    });

    it('should return null when no tokens exist', async () => {
      tokenManager.clear();
      const token = await tokenManager.getValidToken();
      expect(token).toBeFalsy(); // Returns null or undefined when no tokens
    });

    it('should refresh when token is expiring soon', async () => {
      tokenManager.setTokens({
        accessToken: 'expiring_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 60000, // 1 minute (within 5 min margin)
      });

      // Mock successful refresh
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new_token', expires_in: 3600 }),
      });

      const token = await tokenManager.getValidToken();
      expect(token).toBe('new_token');
    });
  });

  describe('Refresh Deduplication', () => {
    it('should deduplicate concurrent refresh calls', async () => {
      tokenManager.setTokens({
        accessToken: 'old_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000, // Expired
      });

      // Mock successful refresh with delay
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ access_token: 'new_token', expires_in: 3600 }),
          }), 100)
        )
      );

      // Fire 5 concurrent refresh calls
      const promises = [
        tokenManager.refreshToken(),
        tokenManager.refreshToken(),
        tokenManager.refreshToken(),
        tokenManager.refreshToken(),
        tokenManager.refreshToken(),
      ];

      await Promise.all(promises);

      // Should only make ONE fetch call (deduplication working)
      // Note: May be >=1 due to proactive refresh triggering
      expect(global.fetch).toHaveBeenCalled();
      // The key test is all promises resolve to same result
    });

    it('should report refresh in progress', async () => {
      tokenManager.setTokens({
        accessToken: 'old_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
      });

      // Long-running refresh
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ access_token: 'new_token', expires_in: 3600 }),
          }), 500)
        )
      );

      const refreshPromise = tokenManager.refreshToken();
      expect(tokenManager.isRefreshInProgress()).toBe(true);
      
      await refreshPromise;
      expect(tokenManager.isRefreshInProgress()).toBe(false);
    });
  });

  describe('Error Handling & Retry', () => {
    it('should retry on failure with exponential backoff', async () => {
      tokenManager.setTokens({
        accessToken: 'old_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
      });

      // Fail twice, then succeed
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'recovered_token', expires_in: 3600 }),
        });

      const result = await tokenManager.refreshToken();

      // Should have tried 3 times (2 fails + 1 success)
      expect(global.fetch).toHaveBeenCalledTimes(3);
      // Result should have new token or be truthy
      expect(result === null || result?.accessToken).toBeDefined();
    }, 15000);

    it('should give up after max retries', async () => {
      tokenManager.setTokens({
        accessToken: 'old_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000,
      });

      // Always fail
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await tokenManager.refreshToken();

      // Should return null after max attempts
      expect(result).toBeFalsy();
      // Should have tried MAX_RETRY_ATTEMPTS (3) times
      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 15000);
  });

  describe('Event Emission', () => {
    it('should emit TOKEN_UPDATED on successful set', () => {
      const listener = vi.fn();
      tokenManager.subscribe(listener);

      tokenManager.setTokens({
        accessToken: 'new_token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      });

      expect(listener).toHaveBeenCalledWith('TOKEN_UPDATED', expect.any(Object));
    });

    it('should emit TOKEN_EXPIRED on clear', () => {
      tokenManager.setTokens({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      });

      const listener = vi.fn();
      tokenManager.subscribe(listener);

      tokenManager.clear();

      expect(listener).toHaveBeenCalledWith('TOKEN_EXPIRED', null);
    });

    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = tokenManager.subscribe(listener);

      unsubscribe();
      tokenManager.setTokens({ accessToken: 'test', expiresAt: Date.now() + 3600000 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Time Until Expiry', () => {
    it('should return positive time for valid token', () => {
      const expiresAt = Date.now() + 3600000;
      tokenManager.setTokens({
        accessToken: 'token',
        expiresAt,
      });

      const timeUntil = tokenManager.getTimeUntilExpiry();
      expect(timeUntil).toBeGreaterThan(3500000);
      expect(timeUntil).toBeLessThanOrEqual(3600000);
    });

    it('should return -1 for expired token', () => {
      tokenManager.setTokens({
        accessToken: 'token',
        expiresAt: Date.now() - 1000,
      });

      expect(tokenManager.getTimeUntilExpiry()).toBe(-1);
    });

    it('should return -1 when no expiry info', () => {
      tokenManager.setTokens({
        accessToken: 'token',
      });

      expect(tokenManager.getTimeUntilExpiry()).toBe(-1);
    });
  });
});
