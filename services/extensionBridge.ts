/**
 * Extension Bridge Service
 * Handles communication between Music Companion and external extensions
 * 
 * Supports:
 * - Browser extensions (via window.postMessage)
 * - VS Code extensions (via window.postMessage from webview)
 * - Potential Electron IPC if running as desktop app
 */

import { Song } from '../types';

// --- TYPES ---

export type ExtensionType = 'browser' | 'vscode' | 'desktop';

export interface ExtensionMessage {
  channel: string;
  type: string;
  data: any;
  source: ExtensionType;
  timestamp: number;
}

export interface ExtensionContext {
  type: ExtensionType;
  context: string; // e.g., "coding", "browsing-youtube", "gaming"
  metadata?: Record<string, any>;
}

// Message channel names
export const CHANNELS = {
  BROWSER: 'mc-browser-extension',
  VSCODE: 'mc-vscode-extension',
  DESKTOP: 'mc-desktop-app',
  OUTBOUND: 'mc-to-extension'
} as const;

// --- STATE ---

const extensionCallbacks: Map<string, ((message: ExtensionMessage) => void)[]> = new Map();
const connectedExtensions: Set<ExtensionType> = new Set();
let contextHistory: ExtensionContext[] = [];
const MAX_CONTEXT_HISTORY = 20;

// --- INITIALIZATION ---

/**
 * Initialize the extension bridge
 * Sets up message listeners for incoming extension messages
 */
export function initializeExtensionBridge(): void {
  // Listen for messages from extensions
  window.addEventListener('message', handleIncomingMessage);
  
  // Announce that Music Companion is ready
  setTimeout(() => {
    broadcastToExtensions({
      type: 'MC_READY',
      data: {
        version: '1.0.0',
        capabilities: ['context-music', 'playback-control', 'mood-sync']
      }
    });
  }, 1000);
  
  console.log('[ExtensionBridge] Initialized and listening for extensions');
}

/**
 * Handle incoming messages from extensions
 */
function handleIncomingMessage(event: MessageEvent): void {
  // Validate message structure
  if (!event.data || typeof event.data !== 'object') return;
  if (!event.data.channel) return;
  
  // Check if it's meant for us
  const validChannels = Object.values(CHANNELS);
  if (!validChannels.includes(event.data.channel)) return;
  
  const message: ExtensionMessage = {
    channel: event.data.channel,
    type: event.data.type || 'unknown',
    data: event.data.data || {},
    source: detectExtensionType(event.data.channel),
    timestamp: Date.now()
  };
  
  // Track connected extensions
  connectedExtensions.add(message.source);
  
  // Handle specific message types
  handleMessageType(message);
  
  // Notify registered callbacks
  const callbacks = extensionCallbacks.get(message.type) || [];
  callbacks.forEach(cb => {
    try {
      cb(message);
    } catch (e) {
      console.error('[ExtensionBridge] Callback error:', e);
    }
  });
}

/**
 * Detect extension type from channel
 */
function detectExtensionType(channel: string): ExtensionType {
  if (channel === CHANNELS.BROWSER) return 'browser';
  if (channel === CHANNELS.VSCODE) return 'vscode';
  if (channel === CHANNELS.DESKTOP) return 'desktop';
  return 'browser';
}

/**
 * Handle specific message types
 */
function handleMessageType(message: ExtensionMessage): void {
  switch (message.type) {
    case 'CONTEXT_UPDATE':
      handleContextUpdate(message);
      break;
    case 'EXTENSION_CONNECTED':
      console.log(`[ExtensionBridge] ${message.source} extension connected`);
      break;
    case 'EXTENSION_DISCONNECTED':
      connectedExtensions.delete(message.source);
      break;
    case 'REQUEST_STATE':
      // Extension is asking for current state
      sendCurrentState(message.source);
      break;
  }
}

/**
 * Handle context update from extension
 */
function handleContextUpdate(message: ExtensionMessage): void {
  const context: ExtensionContext = {
    type: message.source,
    context: message.data.context || 'unknown',
    metadata: message.data.metadata
  };
  
  // Add to history
  contextHistory.unshift(context);
  if (contextHistory.length > MAX_CONTEXT_HISTORY) {
    contextHistory.pop();
  }
  
  // Dispatch custom event for the app to handle
  window.dispatchEvent(new CustomEvent('mc:contextUpdate', {
    detail: context
  }));
}

// --- PUBLIC API ---

/**
 * Send a message to all connected extensions
 */
export function broadcastToExtensions(message: { type: string; data: any }): void {
  window.postMessage({
    channel: CHANNELS.OUTBOUND,
    type: message.type,
    data: message.data,
    timestamp: Date.now()
  }, '*');
}

/**
 * Send current playback state to a specific extension
 */
function sendCurrentState(target: ExtensionType): void {
  // The app should call this via registered handlers
  window.dispatchEvent(new CustomEvent('mc:requestState', {
    detail: { target }
  }));
}

/**
 * Notify extensions of a song change
 */
export function notifySongChange(song: Song | null): void {
  broadcastToExtensions({
    type: 'SONG_CHANGED',
    data: song ? {
      title: song.title,
      artist: song.artist,
      album: song.album,
      coverUrl: song.coverUrl,
      duration: song.duration,
      mood: song.mood
    } : null
  });
}

/**
 * Notify extensions of playback state change
 */
export function notifyPlaybackState(isPlaying: boolean): void {
  broadcastToExtensions({
    type: 'PLAYBACK_STATE',
    data: { isPlaying }
  });
}

/**
 * Request context from extensions
 */
export function requestContext(): void {
  broadcastToExtensions({
    type: 'REQUEST_CONTEXT',
    data: {}
  });
}

/**
 * Register a callback for a specific message type
 */
export function onMessage(type: string, callback: (message: ExtensionMessage) => void): () => void {
  if (!extensionCallbacks.has(type)) {
    extensionCallbacks.set(type, []);
  }
  extensionCallbacks.get(type)!.push(callback);
  
  // Return unsubscribe function
  return () => {
    const callbacks = extensionCallbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    }
  };
}

/**
 * Get list of connected extensions
 */
export function getConnectedExtensions(): ExtensionType[] {
  return Array.from(connectedExtensions);
}

/**
 * Check if a specific extension type is connected
 */
export function isExtensionConnected(type: ExtensionType): boolean {
  return connectedExtensions.has(type);
}

/**
 * Get recent context history
 */
export function getContextHistory(): ExtensionContext[] {
  return [...contextHistory];
}

/**
 * Get the most recent context
 */
export function getCurrentContext(): ExtensionContext | null {
  return contextHistory[0] || null;
}

/**
 * Clear extension state on disconnect
 */
export function cleanup(): void {
  window.removeEventListener('message', handleIncomingMessage);
  extensionCallbacks.clear();
  connectedExtensions.clear();
  contextHistory = [];
}

// --- EXTENSION INSTALLATION GUIDES ---

export const EXTENSION_GUIDES = {
  browser: {
    title: 'Browser Extension',
    description: 'Detect tabs and send context to Music Companion',
    status: 'coming-soon',
    instructions: [
      'Browser extension is currently in development',
      'Check back soon for installation instructions',
      'Will support Chrome, Firefox, and Edge'
    ]
  },
  vscode: {
    title: 'VS Code Extension',
    description: 'Sync coding activity with your music',
    status: 'coming-soon',
    instructions: [
      'VS Code extension is currently in development',
      'Will detect file types, git activity, and focus mode',
      'Automatically suggest coding music'
    ]
  },
  desktop: {
    title: 'Desktop App',
    description: 'Full system integration with Discord and more',
    status: 'coming-soon',
    instructions: [
      'Desktop app enables Discord Rich Presence',
      'System-wide media key support',
      'Runs in system tray'
    ]
  }
};
