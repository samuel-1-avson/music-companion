/**
 * Discord OAuth Service
 * Handles Discord OAuth2 authentication flow
 */
import axios from 'axios';
import { config } from '../utils/config.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';

// Scopes for Discord OAuth
const DISCORD_SCOPES = ['identify', 'email'].join(' ');

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  email?: string;
  verified?: boolean;
}

export interface DiscordTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Generate Discord OAuth authorization URL
 */
export function getDiscordAuthUrl(state: string): string {
  const redirectUri = `${config.frontendUrl.replace('5173', '3001')}/auth/discord/callback`;
  
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DISCORD_SCOPES,
    state,
    prompt: 'consent',
  });

  return `${DISCORD_AUTH_URL}?${params.toString()}`;
}

/**
 * Get the redirect URI for Discord OAuth
 */
export function getDiscordRedirectUri(): string {
  // Backend runs on port 3001
  return `${config.frontendUrl.replace('5173', '3001')}/auth/discord/callback`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<DiscordTokens> {
  const redirectUri = getDiscordRedirectUri();

  const response = await axios.post(
    DISCORD_TOKEN_URL,
    new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

/**
 * Refresh Discord access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<DiscordTokens> {
  const response = await axios.post(
    DISCORD_TOKEN_URL,
    new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

/**
 * Get Discord user profile
 */
export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await axios.get(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

/**
 * Get Discord avatar URL
 */
export function getDiscordAvatarUrl(userId: string, avatarHash?: string): string {
  if (!avatarHash) {
    // Default avatar based on discriminator or user ID
    const defaultAvatarNumber = (BigInt(userId) >> BigInt(22)) % BigInt(6);
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  
  const extension = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}`;
}

/**
 * Revoke Discord access token
 */
export async function revokeToken(token: string): Promise<void> {
  try {
    await axios.post(
      `${DISCORD_TOKEN_URL}/revoke`,
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  } catch (error) {
    console.error('[Discord] Token revocation failed:', error);
  }
}

export default {
  getDiscordAuthUrl,
  getDiscordRedirectUri,
  exchangeCodeForTokens,
  refreshAccessToken,
  getDiscordUser,
  getDiscordAvatarUrl,
  revokeToken,
};
