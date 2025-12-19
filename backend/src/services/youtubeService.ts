/**
 * YouTube OAuth Service
 * Handles Google OAuth2 for YouTube Data API access
 */
import axios from 'axios';
import { config } from '../utils/config.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Scopes for YouTube access
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export interface YouTubeTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount?: number;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
}

/**
 * Get the redirect URI for YouTube OAuth
 */
export function getYouTubeRedirectUri(): string {
  return `${config.frontendUrl.replace('5173', '3001')}/auth/youtube/callback`;
}

/**
 * Generate Google OAuth authorization URL for YouTube
 */
export function getYouTubeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.youtube.clientId,
    redirect_uri: getYouTubeRedirectUri(),
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    state,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent to get refresh token
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokens> {
  const response = await axios.post(
    GOOGLE_TOKEN_URL,
    new URLSearchParams({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getYouTubeRedirectUri(),
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
 * Refresh YouTube access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<YouTubeTokens> {
  const response = await axios.post(
    GOOGLE_TOKEN_URL,
    new URLSearchParams({
      client_id: config.youtube.clientId,
      client_secret: config.youtube.clientSecret,
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
 * Get user's YouTube channel info
 */
export async function getMyChannel(accessToken: string): Promise<YouTubeChannel | null> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
      params: {
        part: 'snippet,statistics',
        mine: true,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const channel = response.data.items?.[0];
    if (!channel) return null;

    return {
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnailUrl: channel.snippet.thumbnails?.default?.url || '',
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
    };
  } catch (error) {
    console.error('[YouTube] Get channel error:', error);
    return null;
  }
}

/**
 * Get user's Google profile email
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.email || '';
  } catch (error) {
    console.error('[YouTube] Get user email error:', error);
    return '';
  }
}

/**
 * Get user's YouTube playlists
 */
export async function getMyPlaylists(accessToken: string, maxResults: number = 25): Promise<YouTubePlaylist[]> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/playlists`, {
      params: {
        part: 'snippet,contentDetails',
        mine: true,
        maxResults,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return (response.data.items || []).map((playlist: any) => ({
      id: playlist.id,
      title: playlist.snippet.title,
      description: playlist.snippet.description,
      thumbnailUrl: playlist.snippet.thumbnails?.default?.url || '',
      itemCount: playlist.contentDetails?.itemCount || 0,
    }));
  } catch (error) {
    console.error('[YouTube] Get playlists error:', error);
    return [];
  }
}

/**
 * Search YouTube videos
 */
export async function searchVideos(
  accessToken: string | null, 
  query: string, 
  maxResults: number = 10
): Promise<any[]> {
  try {
    const headers: Record<string, string> = {};
    const params: Record<string, string | number> = {
      part: 'snippet',
      q: query,
      type: 'video',
      videoCategoryId: '10', // Music category
      maxResults,
    };

    // Use OAuth token if available, otherwise use API key
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (config.youtube.apiKey) {
      params.key = config.youtube.apiKey;
    } else {
      throw new Error('No YouTube authentication available');
    }

    const response = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params,
      headers,
    });

    return response.data.items || [];
  } catch (error) {
    console.error('[YouTube] Search error:', error);
    return [];
  }
}

export default {
  getYouTubeAuthUrl,
  getYouTubeRedirectUri,
  exchangeCodeForTokens,
  refreshAccessToken,
  getMyChannel,
  getUserEmail,
  getMyPlaylists,
  searchVideos,
};
