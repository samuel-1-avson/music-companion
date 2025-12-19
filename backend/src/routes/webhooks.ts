/**
 * Webhook Routes
 * Server-side webhook management and dispatch
 */
import { Router } from 'express';
import type { Webhook, WebhookEvent } from '../types/index.js';

const router = Router();

// In-memory webhook store (use database in production)
const webhooks = new Map<string, Webhook>();

// Webhook execution logs
const webhookLogs: Array<{
  id: string;
  webhookId: string;
  event: WebhookEvent;
  timestamp: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}> = [];
const MAX_LOGS = 100;

// --- WEBHOOK MANAGEMENT ---

/**
 * List all webhooks
 * GET /api/webhooks
 */
router.get('/', (req, res) => {
  const list = Array.from(webhooks.values());
  res.json({ success: true, data: list });
});

/**
 * Get a specific webhook
 * GET /api/webhooks/:id
 */
router.get('/:id', (req, res) => {
  const webhook = webhooks.get(req.params.id);
  if (!webhook) {
    return res.status(404).json({ success: false, error: 'Webhook not found' });
  }
  res.json({ success: true, data: webhook });
});

/**
 * Create a webhook
 * POST /api/webhooks
 */
router.post('/', (req, res) => {
  const { name, url, events, secret } = req.body;

  if (!name || !url || !events || !Array.isArray(events)) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  const validEvents: WebhookEvent[] = [
    'SONG_CHANGED', 'PLAYBACK_PAUSED', 'PLAYBACK_RESUMED',
    'MOOD_CHANGED', 'FAVORITE_ADDED', 'PLAYLIST_GENERATED'
  ];
  const filteredEvents = events.filter(e => validEvents.includes(e));

  if (filteredEvents.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid events provided' });
  }

  const webhook: Webhook = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name,
    url,
    events: filteredEvents,
    secret,
    enabled: true,
    createdAt: Date.now(),
    failureCount: 0
  };

  webhooks.set(webhook.id, webhook);
  res.json({ success: true, data: webhook });
});

/**
 * Update a webhook
 * PATCH /api/webhooks/:id
 */
router.patch('/:id', (req, res) => {
  const webhook = webhooks.get(req.params.id);
  if (!webhook) {
    return res.status(404).json({ success: false, error: 'Webhook not found' });
  }

  const { name, url, events, secret, enabled } = req.body;
  
  if (name) webhook.name = name;
  if (url) webhook.url = url;
  if (events) webhook.events = events;
  if (secret !== undefined) webhook.secret = secret;
  if (enabled !== undefined) webhook.enabled = enabled;

  webhooks.set(webhook.id, webhook);
  res.json({ success: true, data: webhook });
});

/**
 * Delete a webhook
 * DELETE /api/webhooks/:id
 */
router.delete('/:id', (req, res) => {
  if (webhooks.has(req.params.id)) {
    webhooks.delete(req.params.id);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'Webhook not found' });
  }
});

/**
 * Toggle webhook enabled state
 * POST /api/webhooks/:id/toggle
 */
router.post('/:id/toggle', (req, res) => {
  const webhook = webhooks.get(req.params.id);
  if (!webhook) {
    return res.status(404).json({ success: false, error: 'Webhook not found' });
  }

  webhook.enabled = !webhook.enabled;
  webhooks.set(webhook.id, webhook);
  res.json({ success: true, data: { enabled: webhook.enabled } });
});

/**
 * Test a webhook
 * POST /api/webhooks/:id/test
 */
router.post('/:id/test', async (req, res) => {
  const webhook = webhooks.get(req.params.id);
  if (!webhook) {
    return res.status(404).json({ success: false, error: 'Webhook not found' });
  }

  const result = await sendWebhook(webhook, 'SONG_CHANGED', {
    test: true,
    song: {
      title: 'Test Song',
      artist: 'Music Companion',
      album: 'Test Album'
    }
  });

  res.json({ success: result.success, error: result.error });
});

/**
 * Get webhook logs
 * GET /api/webhooks/:id/logs
 */
router.get('/:id/logs', (req, res) => {
  const logs = webhookLogs.filter(l => l.webhookId === req.params.id);
  res.json({ success: true, data: logs });
});

// --- WEBHOOK DISPATCH ---

async function sendWebhook(
  webhook: Webhook, 
  event: WebhookEvent, 
  data: any
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    event,
    timestamp: Date.now(),
    data,
    source: 'music-companion',
    version: '1.0'
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Music-Companion-Event': event,
      'X-Music-Companion-Timestamp': payload.timestamp.toString()
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const crypto = await import('crypto');
      const signature = crypto.createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Music-Companion-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const success = response.ok;

    // Log the attempt
    addLog({
      webhookId: webhook.id,
      event,
      timestamp: Date.now(),
      success,
      statusCode: response.status,
      error: success ? undefined : `HTTP ${response.status}`
    });

    // Update webhook status
    webhook.lastTriggered = Date.now();
    webhook.failureCount = success ? 0 : webhook.failureCount + 1;
    
    // Auto-disable after 5 failures
    if (webhook.failureCount >= 5) {
      webhook.enabled = false;
    }

    return { success, error: success ? undefined : `HTTP ${response.status}` };
  } catch (err: any) {
    addLog({
      webhookId: webhook.id,
      event,
      timestamp: Date.now(),
      success: false,
      error: err.message
    });

    webhook.failureCount++;
    if (webhook.failureCount >= 5) webhook.enabled = false;

    return { success: false, error: err.message };
  }
}

function addLog(log: Omit<typeof webhookLogs[0], 'id'>) {
  webhookLogs.unshift({
    id: `log_${Date.now()}`,
    ...log
  });
  if (webhookLogs.length > MAX_LOGS) webhookLogs.pop();
}

/**
 * Dispatch an event to all matching webhooks
 */
export async function dispatchWebhookEvent(event: WebhookEvent, data: any): Promise<number> {
  const activeWebhooks = Array.from(webhooks.values())
    .filter(w => w.enabled && w.events.includes(event));

  if (activeWebhooks.length === 0) return 0;

  const results = await Promise.allSettled(
    activeWebhooks.map(webhook => sendWebhook(webhook, event, data))
  );

  return results.filter(r => r.status === 'fulfilled' && r.value.success).length;
}

export default router;
