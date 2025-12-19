import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
  clear: vi.fn(() => { localStorageMock.store = {}; })
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('developerApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('API Key Management', () => {
    it('should create a new API key with scopes', async () => {
      const { createApiKey, loadApiKeys } = await import('../../services/developerApiService');
      
      const key = createApiKey('Test Key', ['player:read', 'player:control']);
      
      expect(key).toBeDefined();
      expect(key.name).toBe('Test Key');
      expect(key.key).toMatch(/^mc_/);
      expect(key.scopes).toContain('player:read');
      expect(key.scopes).toContain('player:control');
      expect(key.createdAt).toBeDefined();
      
      const keys = loadApiKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0].id).toBe(key.id);
    });

    it('should validate a valid API key', async () => {
      const { createApiKey, validateApiKey } = await import('../../services/developerApiService');
      
      const created = createApiKey('Valid Key', ['player:read']);
      const result = validateApiKey(created.key);
      
      expect(result.valid).toBe(true);
      expect(result.scopes).toContain('player:read');
      expect(result.keyId).toBe(created.id);
    });

    it('should return invalid for unknown key', async () => {
      const { validateApiKey } = await import('../../services/developerApiService');
      
      const result = validateApiKey('mc_invalid_key_12345');
      
      expect(result.valid).toBe(false);
      expect(result.scopes).toHaveLength(0);
    });

    it('should revoke an API key', async () => {
      const { createApiKey, revokeApiKey, loadApiKeys } = await import('../../services/developerApiService');
      
      const key = createApiKey('To Revoke', ['player:read']);
      expect(loadApiKeys()).toHaveLength(1);
      
      const revoked = revokeApiKey(key.id);
      
      expect(revoked).toBe(true);
      expect(loadApiKeys()).toHaveLength(0);
    });

    it('should check scope permissions', async () => {
      const { createApiKey, hasScope } = await import('../../services/developerApiService');
      
      const key = createApiKey('Limited Key', ['player:read']);
      
      expect(hasScope(key.key, 'player:read')).toBe(true);
      expect(hasScope(key.key, 'player:control')).toBe(false);
      expect(hasScope(key.key, 'ai:generate')).toBe(false);
    });
  });

  describe('Event System', () => {
    it('should dispatch and receive events', async () => {
      const { onApiEvent, dispatchApiEvent } = await import('../../services/developerApiService');
      
      const callback = vi.fn();
      const unsubscribe = onApiEvent('songChanged', callback);
      
      dispatchApiEvent('songChanged', { title: 'Test Song' });
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'songChanged',
        data: { title: 'Test Song' }
      }));
      
      unsubscribe();
    });

    it('should track event log', async () => {
      const { dispatchApiEvent, getEventLog } = await import('../../services/developerApiService');
      
      // Get current log length before dispatching
      const logBefore = getEventLog(100);
      const countBefore = logBefore.length;
      
      dispatchApiEvent('songChanged', { title: 'Song 1' });
      dispatchApiEvent('playbackStateChanged', { isPlaying: true });
      
      const log = getEventLog(100);
      
      // Should have at least 2 more entries
      expect(log.length).toBeGreaterThanOrEqual(countBefore + 2);
      
      // Most recent should be playbackStateChanged
      expect(log[0].type).toBe('playbackStateChanged');
      expect(log[1].type).toBe('songChanged');
    });
  });

  describe('MusicCompanionAPI Class', () => {
    it('should initialize and expose API on window', async () => {
      const { initializeDeveloperApi } = await import('../../services/developerApiService');
      
      const api = initializeDeveloperApi();
      
      expect(api).toBeDefined();
      expect((window as any).MusicCompanionAPI).toBe(api);
      expect(api.getVersion()).toBe('1.0.0');
    });

    it('should require authentication for protected methods', async () => {
      const { initializeDeveloperApi, createApiKey } = await import('../../services/developerApiService');
      
      const api = initializeDeveloperApi();
      
      // Without auth, should return null/empty
      expect(api.getCurrentSong()).toBeNull();
      expect(api.getQueue()).toEqual([]);
      
      // Create a key and authenticate
      const key = createApiKey('Auth Test', ['player:read']);
      const authResult = api.authenticate(key.key);
      
      expect(authResult.success).toBe(true);
      expect(authResult.scopes).toContain('player:read');
    });
  });
});
