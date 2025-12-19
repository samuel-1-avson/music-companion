/**
 * Webhook Service
 * Allows users to configure external webhooks that receive events
 * 
 * Can be used for integrations with:
 * - IFTTT
 * - Zapier
 * - Custom servers
 * - Home automation systems
 */

// --- TYPES ---

export type WebhookEvent = 
  | 'SONG_CHANGED' 
  | 'PLAYBACK_PAUSED' 
  | 'PLAYBACK_RESUMED' 
  | 'MOOD_CHANGED'
  | 'FAVORITE_ADDED'
  | 'PLAYLIST_GENERATED';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
  failureCount: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: number;
  data: any;
  source: 'music-companion';
  version: '1.0';
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  timestamp: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}

// --- STORAGE ---

const WEBHOOKS_STORAGE_KEY = 'mc_webhooks';
const WEBHOOK_LOGS_KEY = 'mc_webhook_logs';
const MAX_LOGS = 50;

function loadWebhooks(): Webhook[] {
  try {
    const stored = localStorage.getItem(WEBHOOKS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveWebhooks(webhooks: Webhook[]): void {
  localStorage.setItem(WEBHOOKS_STORAGE_KEY, JSON.stringify(webhooks));
}

function loadLogs(): WebhookLog[] {
  try {
    const stored = localStorage.getItem(WEBHOOK_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: WebhookLog[]): void {
  localStorage.setItem(WEBHOOK_LOGS_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
}

function addLog(log: Omit<WebhookLog, 'id'>): void {
  const logs = loadLogs();
  logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    ...log
  });
  saveLogs(logs);
}

// --- WEBHOOK MANAGEMENT ---

/**
 * Get all configured webhooks
 */
export function getWebhooks(): Webhook[] {
  return loadWebhooks();
}

/**
 * Get a specific webhook by ID
 */
export function getWebhook(id: string): Webhook | null {
  const webhooks = loadWebhooks();
  return webhooks.find(w => w.id === id) || null;
}

/**
 * Create a new webhook
 */
export function createWebhook(
  name: string,
  url: string,
  events: WebhookEvent[],
  secret?: string
): Webhook {
  const webhooks = loadWebhooks();
  
  const newWebhook: Webhook = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    name,
    url,
    events,
    secret,
    enabled: true,
    createdAt: Date.now(),
    failureCount: 0
  };
  
  webhooks.push(newWebhook);
  saveWebhooks(webhooks);
  
  return newWebhook;
}

/**
 * Update a webhook
 */
export function updateWebhook(
  id: string, 
  updates: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'secret' | 'enabled'>>
): Webhook | null {
  const webhooks = loadWebhooks();
  const index = webhooks.findIndex(w => w.id === id);
  
  if (index !== -1) {
    webhooks[index] = { ...webhooks[index], ...updates };
    saveWebhooks(webhooks);
    return webhooks[index];
  }
  
  return null;
}

/**
 * Delete a webhook
 */
export function deleteWebhook(id: string): boolean {
  const webhooks = loadWebhooks();
  const index = webhooks.findIndex(w => w.id === id);
  
  if (index !== -1) {
    webhooks.splice(index, 1);
    saveWebhooks(webhooks);
    return true;
  }
  
  return false;
}

/**
 * Toggle webhook enabled state
 */
export function toggleWebhook(id: string): boolean {
  const webhooks = loadWebhooks();
  const webhook = webhooks.find(w => w.id === id);
  
  if (webhook) {
    webhook.enabled = !webhook.enabled;
    saveWebhooks(webhooks);
    return webhook.enabled;
  }
  
  return false;
}

// --- WEBHOOK DISPATCH ---

/**
 * Generate HMAC signature for webhook payload
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signature));
  return 'sha256=' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send webhook to a single endpoint
 */
async function sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<boolean> {
  try {
    const payloadString = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Music-Companion-Event': payload.event,
      'X-Music-Companion-Timestamp': payload.timestamp.toString()
    };
    
    // Add signature if secret is configured
    if (webhook.secret) {
      headers['X-Music-Companion-Signature'] = await generateSignature(payloadString, webhook.secret);
    }
    
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      // Short timeout to avoid blocking
      signal: AbortSignal.timeout(5000)
    });
    
    const success = response.ok;
    
    // Log the attempt
    addLog({
      webhookId: webhook.id,
      event: payload.event,
      timestamp: Date.now(),
      success,
      statusCode: response.status,
      error: success ? undefined : `HTTP ${response.status}`
    });
    
    // Update webhook status
    const webhooks = loadWebhooks();
    const wh = webhooks.find(w => w.id === webhook.id);
    if (wh) {
      wh.lastTriggered = Date.now();
      wh.failureCount = success ? 0 : wh.failureCount + 1;
      
      // Auto-disable after 5 consecutive failures
      if (wh.failureCount >= 5) {
        wh.enabled = false;
        console.warn(`Webhook ${wh.name} disabled after 5 failures`);
      }
      
      saveWebhooks(webhooks);
    }
    
    return success;
  } catch (error: any) {
    // Log the error
    addLog({
      webhookId: webhook.id,
      event: payload.event,
      timestamp: Date.now(),
      success: false,
      error: error.message || 'Network error'
    });
    
    // Update failure count
    const webhooks = loadWebhooks();
    const wh = webhooks.find(w => w.id === webhook.id);
    if (wh) {
      wh.failureCount++;
      if (wh.failureCount >= 5) wh.enabled = false;
      saveWebhooks(webhooks);
    }
    
    return false;
  }
}

/**
 * Dispatch an event to all registered webhooks
 */
export async function dispatchEvent(event: WebhookEvent, data: any): Promise<number> {
  const webhooks = loadWebhooks();
  const activeWebhooks = webhooks.filter(w => w.enabled && w.events.includes(event));
  
  if (activeWebhooks.length === 0) return 0;
  
  const payload: WebhookPayload = {
    event,
    timestamp: Date.now(),
    data,
    source: 'music-companion',
    version: '1.0'
  };
  
  // Send to all webhooks in parallel
  const results = await Promise.allSettled(
    activeWebhooks.map(webhook => sendWebhook(webhook, payload))
  );
  
  // Count successes
  return results.filter(r => r.status === 'fulfilled' && r.value).length;
}

/**
 * Get webhook logs
 */
export function getWebhookLogs(webhookId?: string, limit: number = 20): WebhookLog[] {
  let logs = loadLogs();
  if (webhookId) {
    logs = logs.filter(l => l.webhookId === webhookId);
  }
  return logs.slice(0, limit);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  localStorage.removeItem(WEBHOOK_LOGS_KEY);
}

/**
 * Test a webhook with a sample payload
 */
export async function testWebhook(webhookId: string): Promise<{ success: boolean; error?: string }> {
  const webhook = getWebhook(webhookId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found' };
  }
  
  const testPayload: WebhookPayload = {
    event: 'SONG_CHANGED',
    timestamp: Date.now(),
    data: {
      test: true,
      song: {
        title: 'Test Song',
        artist: 'Music Companion',
        album: 'Test Album'
      }
    },
    source: 'music-companion',
    version: '1.0'
  };
  
  const success = await sendWebhook(webhook, testPayload);
  return { 
    success, 
    error: success ? undefined : 'Failed to reach webhook URL'
  };
}

// --- EVENT CONSTANTS ---

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { 
    value: 'SONG_CHANGED', 
    label: 'Song Changed', 
    description: 'Triggered when a new song starts playing' 
  },
  { 
    value: 'PLAYBACK_PAUSED', 
    label: 'Playback Paused', 
    description: 'Triggered when music is paused' 
  },
  { 
    value: 'PLAYBACK_RESUMED', 
    label: 'Playback Resumed', 
    description: 'Triggered when music resumes after pause' 
  },
  { 
    value: 'MOOD_CHANGED', 
    label: 'Mood Changed', 
    description: 'Triggered when listening mood analysis updates' 
  },
  { 
    value: 'FAVORITE_ADDED', 
    label: 'Favorite Added', 
    description: 'Triggered when a song is added to favorites' 
  },
  { 
    value: 'PLAYLIST_GENERATED', 
    label: 'Playlist Generated', 
    description: 'Triggered when AI generates a new playlist' 
  }
];
