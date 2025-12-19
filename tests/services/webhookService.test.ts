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

// Mock fetch
global.fetch = vi.fn();

describe('webhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as any).mockReset();
  });

  describe('Webhook Management', () => {
    it('should create a new webhook', async () => {
      const { createWebhook, getWebhooks } = await import('../../services/webhookService');
      
      const webhook = createWebhook(
        'Test Webhook',
        'https://example.com/webhook',
        ['SONG_CHANGED', 'PLAYBACK_PAUSED']
      );
      
      expect(webhook).toBeDefined();
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain('SONG_CHANGED');
      expect(webhook.events).toContain('PLAYBACK_PAUSED');
      expect(webhook.enabled).toBe(true);
      expect(webhook.failureCount).toBe(0);
      
      const webhooks = getWebhooks();
      expect(webhooks).toHaveLength(1);
    });

    it('should update a webhook', async () => {
      const { createWebhook, updateWebhook, getWebhook } = await import('../../services/webhookService');
      
      const webhook = createWebhook('Original', 'https://example.com', ['SONG_CHANGED']);
      
      updateWebhook(webhook.id, {
        name: 'Updated Name',
        events: ['SONG_CHANGED', 'MOOD_CHANGED']
      });
      
      const updated = getWebhook(webhook.id);
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.events).toContain('MOOD_CHANGED');
    });

    it('should delete a webhook', async () => {
      const { createWebhook, deleteWebhook, getWebhooks } = await import('../../services/webhookService');
      
      const webhook = createWebhook('To Delete', 'https://example.com', ['SONG_CHANGED']);
      expect(getWebhooks()).toHaveLength(1);
      
      const deleted = deleteWebhook(webhook.id);
      
      expect(deleted).toBe(true);
      expect(getWebhooks()).toHaveLength(0);
    });

    it('should toggle webhook enabled state', async () => {
      const { createWebhook, toggleWebhook, getWebhook } = await import('../../services/webhookService');
      
      const webhook = createWebhook('Toggle Test', 'https://example.com', ['SONG_CHANGED']);
      expect(webhook.enabled).toBe(true);
      
      toggleWebhook(webhook.id);
      expect(getWebhook(webhook.id)?.enabled).toBe(false);
      
      toggleWebhook(webhook.id);
      expect(getWebhook(webhook.id)?.enabled).toBe(true);
    });
  });

  describe('Event Dispatching', () => {
    it('should dispatch events to matching webhooks', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
      
      const { createWebhook, dispatchEvent } = await import('../../services/webhookService');
      
      createWebhook('Song Hook', 'https://example.com/songs', ['SONG_CHANGED']);
      createWebhook('Pause Hook', 'https://example.com/pause', ['PLAYBACK_PAUSED']);
      
      const successCount = await dispatchEvent('SONG_CHANGED', { title: 'Test' });
      
      expect(successCount).toBe(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/songs',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('SONG_CHANGED')
        })
      );
    });

    it('should not dispatch to disabled webhooks', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
      
      const { createWebhook, toggleWebhook, dispatchEvent } = await import('../../services/webhookService');
      
      const webhook = createWebhook('Disabled Hook', 'https://example.com', ['SONG_CHANGED']);
      toggleWebhook(webhook.id); // Disable it
      
      const successCount = await dispatchEvent('SONG_CHANGED', { title: 'Test' });
      
      expect(successCount).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle webhook failures and increment failure count', async () => {
      (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
      
      const { createWebhook, dispatchEvent, getWebhook } = await import('../../services/webhookService');
      
      const webhook = createWebhook('Failing Hook', 'https://example.com', ['SONG_CHANGED']);
      
      await dispatchEvent('SONG_CHANGED', { title: 'Test' });
      
      const updated = getWebhook(webhook.id);
      expect(updated?.failureCount).toBe(1);
    });
  });

  describe('Test Webhook', () => {
    it('should send test payload to webhook', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
      
      const { createWebhook, testWebhook } = await import('../../services/webhookService');
      
      const webhook = createWebhook('Test Target', 'https://example.com', ['SONG_CHANGED']);
      
      const result = await testWebhook(webhook.id);
      
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"test":true')
        })
      );
    });

    it('should report failure for non-existent webhook', async () => {
      const { testWebhook } = await import('../../services/webhookService');
      
      const result = await testWebhook('non_existent_id');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook not found');
    });
  });

  describe('Webhook Logs', () => {
    it('should track webhook execution logs', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
      
      const { createWebhook, dispatchEvent, getWebhookLogs } = await import('../../services/webhookService');
      
      const webhook = createWebhook('Logged Hook', 'https://example.com', ['SONG_CHANGED']);
      
      await dispatchEvent('SONG_CHANGED', { title: 'Test 1' });
      await dispatchEvent('SONG_CHANGED', { title: 'Test 2' });
      
      const logs = getWebhookLogs(webhook.id);
      
      expect(logs).toHaveLength(2);
      expect(logs[0].success).toBe(true);
      expect(logs[0].event).toBe('SONG_CHANGED');
    });
  });
});
