/**
 * Discord Rich Presence Service
 * Shows "Now Playing" on Discord profile
 * 
 * Note: Discord RPC only works when:
 * 1. Discord desktop app is running
 * 2. This code runs on the same machine as Discord
 * 3. Discord's "Activity Status" is enabled in settings
 */

import { config } from '../utils/config.js';
import type { Song } from '../types/index.js';

// Discord RPC state
let rpcClient: any = null;
let isConnected = false;
let currentActivity: Song | null = null;
let startTimestamp: number | null = null;

/**
 * Initialize Discord Rich Presence
 */
export async function initializeDiscord(): Promise<boolean> {
  if (!config.discord.isConfigured) {
    console.log('[Discord] Not configured - skipping RPC initialization');
    return false;
  }

  try {
    // Dynamic import to avoid issues if discord-rpc is not installed
    const DiscordRPC = await import('discord-rpc').catch(() => null);
    
    if (!DiscordRPC) {
      console.log('[Discord] discord-rpc package not installed. Run: npm install discord-rpc');
      return false;
    }

    rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

    rpcClient.on('ready', () => {
      console.log('[Discord] RPC connected as', rpcClient.user?.username);
      isConnected = true;
    });

    rpcClient.on('disconnected', () => {
      console.log('[Discord] RPC disconnected');
      isConnected = false;
    });

    await rpcClient.login({ clientId: config.discord.clientId });
    return true;
  } catch (error: any) {
    console.log('[Discord] RPC connection failed:', error.message);
    console.log('[Discord] Make sure Discord desktop app is running');
    return false;
  }
}

/**
 * Update Discord Rich Presence with current song
 */
export async function updatePresence(song: Song | null): Promise<boolean> {
  if (!isConnected || !rpcClient) {
    return false;
  }

  try {
    if (!song) {
      // Clear activity when not playing
      await rpcClient.clearActivity();
      currentActivity = null;
      startTimestamp = null;
      return true;
    }

    // Don't update if same song
    if (currentActivity?.id === song.id) {
      return true;
    }

    // Set new activity
    currentActivity = song;
    startTimestamp = Date.now();

    await rpcClient.setActivity({
      details: song.title,
      state: `by ${song.artist}`,
      startTimestamp: startTimestamp,
      largeImageKey: song.coverUrl || 'music_icon',
      largeImageText: song.album || 'Music Companion',
      smallImageKey: 'play_icon',
      smallImageText: 'Playing',
      instance: false,
      buttons: song.externalUrl ? [
        { label: 'Listen', url: song.externalUrl }
      ] : undefined
    });

    console.log(`[Discord] Now showing: ${song.title} by ${song.artist}`);
    return true;
  } catch (error: any) {
    console.error('[Discord] Failed to update presence:', error.message);
    return false;
  }
}

/**
 * Clear Discord Rich Presence
 */
export async function clearPresence(): Promise<boolean> {
  if (!isConnected || !rpcClient) {
    return false;
  }

  try {
    await rpcClient.clearActivity();
    currentActivity = null;
    startTimestamp = null;
    console.log('[Discord] Presence cleared');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Disconnect Discord RPC
 */
export async function disconnectDiscord(): Promise<void> {
  if (rpcClient) {
    try {
      await rpcClient.destroy();
    } catch (e) {
      // Ignore errors during disconnect
    }
    rpcClient = null;
    isConnected = false;
    console.log('[Discord] RPC client destroyed');
  }
}

/**
 * Check if Discord is connected
 */
export function isDiscordConnected(): boolean {
  return isConnected;
}

/**
 * Get current Discord status
 */
export function getDiscordStatus(): { connected: boolean; currentSong: Song | null } {
  return {
    connected: isConnected,
    currentSong: currentActivity
  };
}
