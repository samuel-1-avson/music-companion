/**
 * Authentication Routes
 * Handles Spotify and Last.fm OAuth flows with email verification
 */
import { Router } from 'express';
import axios from 'axios';
import { config } from '../utils/config.js';
import { generateVerificationCode, sendVerificationCodeEmail } from '../services/emailService.js';

const router = Router();

// Spotify OAuth scopes
const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming'
].join(' ');

// --- SPOTIFY AUTH ---

/**
 * Initiate Spotify OAuth flow
 * GET /auth/spotify?user_id=xxx&user_email=xxx
 */
router.get('/spotify', (req, res) => {
  if (!config.spotify.isConfigured) {
    return res.status(503).json({
      success: false,
      error: 'Spotify not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env'
    });
  }

  const user_id = req.query.user_id as string;
  const user_email = req.query.user_email as string;
  
  // Encode both user_id and user_email in state
  const stateData = JSON.stringify({ user_id, user_email });
  const state = Buffer.from(stateData).toString('base64');
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('client_id', config.spotify.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', config.spotify.redirectUri);
  authUrl.searchParams.set('scope', SPOTIFY_SCOPES);
  authUrl.searchParams.set('show_dialog', 'true');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

/**
 * Spotify OAuth callback with email verification
 * GET /auth/spotify/callback
 */
router.get('/spotify/callback', async (req, res) => {
  const { code, error, state } = req.query;
  
  // Decode state to get user_id and user_email
  let user_id = '';
  let user_email = '';
  try {
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    user_id = stateData.user_id || '';
    user_email = stateData.user_email || '';
  } catch {
    // Fallback for old format (just user_id)
    user_id = state as string;
  }

  if (error) {
    return res.redirect(`${config.frontendUrl}/integrations?error=${encodeURIComponent(error as string)}`);
  }

  if (!code) {
    return res.redirect(`${config.frontendUrl}/integrations?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: config.spotify.redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const token_expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get Spotify user profile
    const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const provider_email = profileResponse.data.email || '';
    const provider_user_id = profileResponse.data.id;
    const provider_username = profileResponse.data.display_name || profileResponse.data.id;
    const provider_avatar_url = profileResponse.data.images?.[0]?.url || '';

    // Check if emails match
    const emailsMatch = user_email.toLowerCase() === provider_email.toLowerCase();

    if (user_id && config.supabase.isConfigured) {
      const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
      
      if (emailsMatch) {
        // Emails match - auto-verify and save
        await axios.post(
          `${config.supabase.url}/rest/v1/user_integrations`,
          {
            user_id,
            provider: 'spotify',
            access_token,
            refresh_token: refresh_token || null,
            token_expires_at,
            provider_user_id,
            provider_username,
            provider_avatar_url,
            provider_email,
            email_verified: true,
            metadata: { scopes: SPOTIFY_SCOPES.split(' ') },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            }
          }
        );
        console.log('[Spotify OAuth] Auto-verified and saved for user:', user_id);
        return res.redirect(`${config.frontendUrl}/integrations?spotify_connected=true`);
      } else {
        // Emails don't match - require verification
        const verificationCode = generateVerificationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // Save pending integration with verification code
        await axios.post(
          `${config.supabase.url}/rest/v1/user_integrations`,
          {
            user_id,
            provider: 'spotify',
            access_token,
            refresh_token: refresh_token || null,
            token_expires_at,
            provider_user_id,
            provider_username,
            provider_avatar_url,
            provider_email,
            email_verified: false,
            verification_code: verificationCode,
            verification_expires_at: expiresAt,
            metadata: { scopes: SPOTIFY_SCOPES.split(' '), pending_verification: true },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            }
          }
        );

        // Send verification email
        await sendVerificationCodeEmail(provider_email, verificationCode, 'spotify', user_email);
        
        console.log('[Spotify OAuth] Verification required for user:', user_id);
        return res.redirect(`${config.frontendUrl}/integrations?verification_required=true&provider=spotify&provider_email=${encodeURIComponent(provider_email)}`);
      }
    }

    // Fallback if no user_id or supabase not configured
    res.redirect(`${config.frontendUrl}/integrations?spotify_connected=true`);
  } catch (err: any) {
    console.error('Spotify token exchange error:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}/integrations?error=token_exchange_failed`);
  }
});

/**
 * Verify integration with email code
 * POST /auth/verify-integration
 */
router.post('/verify-integration', async (req, res) => {
  const { user_id, provider, code } = req.body;

  if (!user_id || !provider || !code) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  if (!config.supabase.isConfigured) {
    return res.status(503).json({ success: false, error: 'Database not configured' });
  }

  try {
    const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;

    // Get the pending integration
    const getResponse = await axios.get(
      `${config.supabase.url}/rest/v1/user_integrations?user_id=eq.${user_id}&provider=eq.${provider}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );

    const integrations = getResponse.data;
    if (!integrations || integrations.length === 0) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    const integration = integrations[0];

    // Check if already verified
    if (integration.email_verified) {
      return res.json({ success: true, message: 'Already verified' });
    }

    // Check if code matches
    if (integration.verification_code !== code) {
      return res.status(400).json({ success: false, error: 'Invalid code' });
    }

    // Check if code expired
    if (new Date(integration.verification_expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Code expired' });
    }

    // Mark as verified
    await axios.patch(
      `${config.supabase.url}/rest/v1/user_integrations?id=eq.${integration.id}`,
      {
        email_verified: true,
        verification_code: null,
        verification_expires_at: null,
        metadata: { ...integration.metadata, pending_verification: false },
        updated_at: new Date().toISOString(),
      },
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('[Auth] Integration verified for user:', user_id, 'provider:', provider);
    return res.json({ success: true, message: 'Integration verified' });
  } catch (err: any) {
    console.error('[Auth] Verification error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

/**
 * Refresh Spotify access token
 * POST /auth/spotify/refresh
 */
router.post('/spotify/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ success: false, error: 'Missing refresh_token' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`
        }
      }
    );

    res.json({
      success: true,
      data: {
        access_token: tokenResponse.data.access_token,
        expires_in: tokenResponse.data.expires_in
      }
    });
  } catch (err: any) {
    console.error('Spotify token refresh error:', err.response?.data || err.message);
    res.status(401).json({ success: false, error: 'Failed to refresh token' });
  }
});

// --- DISCORD AUTH ---

/**
 * Initiate Discord OAuth flow
 * GET /auth/discord?user_id=xxx&user_email=xxx
 */
router.get('/discord', (req, res) => {
  if (!config.discord.isConfigured) {
    return res.status(503).json({
      success: false,
      error: 'Discord not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env'
    });
  }

  const user_id = req.query.user_id as string;
  const user_email = req.query.user_email as string;
  
  // Encode user data in state
  const stateData = JSON.stringify({ user_id, user_email });
  const state = Buffer.from(stateData).toString('base64');
  
  const redirectUri = `${config.backendUrl}/auth/discord/callback`;
  
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
    prompt: 'consent',
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  res.redirect(authUrl);
});

/**
 * Discord OAuth callback
 * GET /auth/discord/callback
 */
router.get('/discord/callback', async (req, res) => {
  const { code, error, state } = req.query;
  
  // Decode state to get user_id
  let user_id = '';
  let user_email = '';
  try {
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    user_id = stateData.user_id || '';
    user_email = stateData.user_email || '';
  } catch {
    user_id = state as string;
  }

  if (error) {
    return res.redirect(`${config.frontendUrl}/integrations?error=${encodeURIComponent(error as string)}`);
  }

  if (!code) {
    return res.redirect(`${config.frontendUrl}/integrations?error=no_code`);
  }

  try {
    const redirectUri = `${config.backendUrl}/auth/discord/callback`;
    
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const token_expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get Discord user profile
    const profileResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const discordUser = profileResponse.data;
    const provider_user_id = discordUser.id;
    const provider_username = discordUser.global_name || discordUser.username;
    const provider_email = discordUser.email || '';
    
    // Generate avatar URL
    let provider_avatar_url = '';
    if (discordUser.avatar) {
      const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
      provider_avatar_url = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}`;
    } else {
      const defaultNum = (BigInt(discordUser.id) >> BigInt(22)) % BigInt(6);
      provider_avatar_url = `https://cdn.discordapp.com/embed/avatars/${defaultNum}.png`;
    }

    // Save to Supabase
    if (user_id && config.supabase.isConfigured) {
      const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
      
      await axios.post(
        `${config.supabase.url}/rest/v1/user_integrations`,
        {
          user_id,
          provider: 'discord',
          access_token,
          refresh_token: refresh_token || null,
          token_expires_at,
          provider_user_id,
          provider_username,
          provider_avatar_url,
          provider_email,
          email_verified: true,
          metadata: { scopes: ['identify', 'email'] },
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          }
        }
      );
      console.log('[Discord OAuth] Saved integration for user:', user_id);
    }

    res.redirect(`${config.frontendUrl}/integrations?discord_connected=true`);
  } catch (err: any) {
    console.error('Discord token exchange error:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}/integrations?error=discord_auth_failed`);
  }
});

/**
 * Refresh Discord access token
 * POST /auth/discord/refresh
 */
router.post('/discord/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ success: false, error: 'Missing refresh_token' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    res.json({
      success: true,
      data: {
        access_token: tokenResponse.data.access_token,
        refresh_token: tokenResponse.data.refresh_token,
        expires_in: tokenResponse.data.expires_in
      }
    });
  } catch (err: any) {
    console.error('Discord token refresh error:', err.response?.data || err.message);
    res.status(401).json({ success: false, error: 'Failed to refresh token' });
  }
});

// --- YOUTUBE AUTH ---

/**
 * Initiate YouTube/Google OAuth flow
 * GET /auth/youtube?user_id=xxx&user_email=xxx
 */
router.get('/youtube', (req, res) => {
  if (!config.youtube.isConfigured) {
    return res.status(503).json({
      success: false,
      error: 'YouTube not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
    });
  }

  const user_id = req.query.user_id as string;
  const user_email = req.query.user_email as string;
  
  // Encode user data in state
  const stateData = JSON.stringify({ user_id, user_email });
  const state = Buffer.from(stateData).toString('base64');
  
  const redirectUri = `${config.backendUrl}/auth/youtube/callback`;
  
  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');
  
  const params = new URLSearchParams({
    client_id: config.youtube.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
});

/**
 * YouTube OAuth callback
 * GET /auth/youtube/callback
 */
router.get('/youtube/callback', async (req, res) => {
  const { code, error, state } = req.query;
  
  // Decode state to get user_id
  let user_id = '';
  let user_email = '';
  try {
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    user_id = stateData.user_id || '';
    user_email = stateData.user_email || '';
  } catch {
    user_id = state as string;
  }

  if (error) {
    return res.redirect(`${config.frontendUrl}/integrations?error=${encodeURIComponent(error as string)}`);
  }

  if (!code) {
    return res.redirect(`${config.frontendUrl}/integrations?error=no_code`);
  }

  try {
    const redirectUri = `${config.backendUrl}/auth/youtube/callback`;
    
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: config.youtube.clientId,
        client_secret: config.youtube.clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const token_expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    const googleUser = userInfoResponse.data;
    const provider_user_id = googleUser.id;
    const provider_username = googleUser.name || googleUser.email?.split('@')[0];
    const provider_email = googleUser.email || '';
    const provider_avatar_url = googleUser.picture || '';

    // Save to Supabase
    if (user_id && config.supabase.isConfigured) {
      const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
      
      await axios.post(
        `${config.supabase.url}/rest/v1/user_integrations`,
        {
          user_id,
          provider: 'youtube',
          access_token,
          refresh_token: refresh_token || null,
          token_expires_at,
          provider_user_id,
          provider_username,
          provider_avatar_url,
          provider_email,
          email_verified: true,
          metadata: { scopes: ['youtube.readonly', 'userinfo.email', 'userinfo.profile'] },
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          }
        }
      );
      console.log('[YouTube OAuth] Saved integration for user:', user_id);
    }

    res.redirect(`${config.frontendUrl}/integrations?youtube_connected=true`);
  } catch (err: any) {
    console.error('YouTube token exchange error:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}/integrations?error=youtube_auth_failed`);
  }
});

/**
 * Refresh YouTube access token
 * POST /auth/youtube/refresh
 */
router.post('/youtube/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ success: false, error: 'Missing refresh_token' });
  }

  try {
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: config.youtube.clientId,
        client_secret: config.youtube.clientSecret,
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    res.json({
      success: true,
      data: {
        access_token: tokenResponse.data.access_token,
        expires_in: tokenResponse.data.expires_in
      }
    });
  } catch (err: any) {
    console.error('YouTube token refresh error:', err.response?.data || err.message);
    res.status(401).json({ success: false, error: 'Failed to refresh token' });
  }
});

// --- LAST.FM AUTH ---

/**
 * Start Last.fm OAuth flow
 * GET /auth/lastfm?user_id=xxx
 */
router.get('/lastfm', (req, res) => {
  if (!config.lastfm.isConfigured) {
    return res.status(503).json({
      success: false,
      error: 'Last.fm not configured. Set LASTFM_API_KEY and LASTFM_SHARED_SECRET in .env'
    });
  }

  const user_id = req.query.user_id as string || '';
  
  // Redirect to backend callback handler (not frontend)
  const callbackUrl = `${config.backendUrl}/auth/lastfm/callback?user_id=${user_id}`;
  const authUrl = `https://www.last.fm/api/auth/?api_key=${config.lastfm.apiKey}&cb=${encodeURIComponent(callbackUrl)}`;

  res.redirect(authUrl);
});

/**
 * Handle Last.fm OAuth callback
 * GET /auth/lastfm/callback?token=xxx&user_id=xxx
 */
router.get('/lastfm/callback', async (req, res) => {
  const token = req.query.token as string;
  const user_id = req.query.user_id as string;

  if (!token) {
    return res.redirect(`${config.frontendUrl}/integrations?error=lastfm_no_token`);
  }

  try {
    // Generate API signature
    const params: Record<string, string> = {
      method: 'auth.getSession',
      api_key: config.lastfm.apiKey,
      token
    };

    const sortedKeys = Object.keys(params).sort();
    let sigString = '';
    for (const key of sortedKeys) {
      sigString += key + params[key];
    }
    sigString += config.lastfm.sharedSecret;

    // Use crypto to generate MD5 hash
    const crypto = await import('crypto');
    const sig = crypto.createHash('md5').update(sigString).digest('hex');

    // Make the API call
    const response = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: {
        ...params,
        api_sig: sig,
        format: 'json'
      }
    });

    if (response.data.session) {
      const { name, key, subscriber } = response.data.session;
      
      // Save to Supabase if user_id is provided
      if (user_id && config.supabase.isConfigured) {
         const supabaseKey = config.supabase.serviceRoleKey || config.supabase.anonKey;
         
         await axios.post(
          `${config.supabase.url}/rest/v1/user_integrations`,
          {
            user_id,
            provider: 'lastfm',
            provider_username: name,
            provider_user_id: name,
            metadata: { session_key: key, subscriber: subscriber === '1' },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates',
            }
          }
        );
        console.log('[Last.fm OAuth] Saved session for user:', user_id);
      }

      res.redirect(`${config.frontendUrl}/integrations?lastfm_connected=true`);
    } else {
      console.error('[Last.fm OAuth] No session in response:', response.data);
      res.redirect(`${config.frontendUrl}/integrations?error=lastfm_auth_failed`);
    }
  } catch (err: any) {
    console.error('[Last.fm OAuth] Error:', err.response?.data || err.message);
    res.redirect(`${config.frontendUrl}/integrations?error=lastfm_auth_failed`);
  }
});

/**
 * Get auth status for all providers
 * GET /auth/status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      spotify: {
        configured: config.spotify.isConfigured,
        authUrl: config.spotify.isConfigured ? '/auth/spotify' : null
      },
      discord: {
        configured: config.discord.isConfigured,
        authUrl: config.discord.isConfigured ? '/auth/discord' : null
      },
      youtube: {
        configured: config.youtube.isConfigured,
        authUrl: config.youtube.isConfigured ? '/auth/youtube' : null
      },
      lastfm: {
        configured: config.lastfm.isConfigured,
        authUrl: config.lastfm.isConfigured ? '/auth/lastfm' : null
      }
    }
  });
});

export default router;
