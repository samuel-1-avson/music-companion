/**
 * OAuth Integration Flow Check Script
 * 
 * Tests and documents how Spotify, Discord, YouTube, Telegram, and Last.fm
 * integrations work in the Music Companion app.
 * 
 * Run with: npx tsx scripts/check-oauth-flows.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================================================
// INTEGRATION FLOW DOCUMENTATION
// ============================================================================

interface IntegrationFlow {
  provider: string;
  emoji: string;
  type: 'oauth' | 'bot' | 'api-key';
  description: string;
  userSteps: string[];
  technicalFlow: string[];
  dataStored: string[];
  endpoints: { method: string; path: string; description: string }[];
  requirements: string[];
  status?: 'OK' | 'ERROR' | 'NOT_CONFIGURED';
}

const INTEGRATION_FLOWS: IntegrationFlow[] = [
  {
    provider: 'Spotify',
    emoji: '🎵',
    type: 'oauth',
    description: 'Connects to Spotify for music playback control, library access, and playlist management.',
    userSteps: [
      '1. User goes to Integrations page in the app',
      '2. Clicks "Connect" on Spotify card',
      '3. Redirected to Spotify login page',
      '4. User logs in and grants permissions',
      '5. Spotify redirects back to app with auth code',
      '6. App exchanges code for access/refresh tokens',
      '7. User profile and tokens saved to Supabase',
      '8. User is now connected!'
    ],
    technicalFlow: [
      'Frontend: window.location.href → /auth/spotify?user_id=xxx&user_email=xxx',
      'Backend: GET /auth/spotify → Redirect to Spotify OAuth',
      'Spotify: User authorizes → Redirect to /auth/spotify/callback?code=xxx',
      'Backend: POST to Spotify API to exchange code for tokens',
      'Backend: GET user profile from Spotify API',
      'Backend: Save to Supabase user_integrations table',
      'Backend: Redirect to frontend /integrations?spotify_connected=true'
    ],
    dataStored: [
      'access_token - For API requests (expires in 1 hour)',
      'refresh_token - For getting new access tokens',
      'provider_user_id - Spotify user ID',
      'provider_username - Display name',
      'provider_email - Email address',
      'provider_avatar_url - Profile picture',
      'scopes - Granted permissions'
    ],
    endpoints: [
      { method: 'GET', path: '/auth/spotify', description: 'Start OAuth flow' },
      { method: 'GET', path: '/auth/spotify/callback', description: 'OAuth callback' },
      { method: 'POST', path: '/auth/spotify/refresh', description: 'Refresh token' }
    ],
    requirements: [
      'SPOTIFY_CLIENT_ID in .env',
      'SPOTIFY_CLIENT_SECRET in .env',
      'Redirect URI configured in Spotify Dashboard: http://localhost:3001/auth/spotify/callback'
    ]
  },
  {
    provider: 'Discord',
    emoji: '💬',
    type: 'oauth',
    description: 'Connects to Discord for Rich Presence (show what you\'re listening to) and account linking.',
    userSteps: [
      '1. User goes to Integrations page',
      '2. Clicks "Connect" on Discord card',
      '3. Redirected to Discord authorization page',
      '4. User logs in and authorizes',
      '5. Discord redirects back with auth code',
      '6. App exchanges code for tokens',
      '7. Profile info saved to Supabase',
      '8. Rich Presence can now show current song!'
    ],
    technicalFlow: [
      'Frontend: window.location.href → /auth/discord?user_id=xxx&user_email=xxx',
      'Backend: GET /auth/discord → Redirect to Discord OAuth',
      'Discord: User authorizes → Redirect to /auth/discord/callback?code=xxx',
      'Backend: POST to Discord API to exchange code for tokens',
      'Backend: GET user profile from Discord API (/users/@me)',
      'Backend: Save to Supabase user_integrations table',
      'Backend: Redirect to frontend /integrations?discord_connected=true'
    ],
    dataStored: [
      'access_token - For API requests',
      'refresh_token - For token refresh',
      'provider_user_id - Discord user ID (snowflake)',
      'provider_username - Username or global name',
      'provider_email - Email address',
      'provider_avatar_url - Avatar URL'
    ],
    endpoints: [
      { method: 'GET', path: '/auth/discord', description: 'Start OAuth flow' },
      { method: 'GET', path: '/auth/discord/callback', description: 'OAuth callback' },
      { method: 'POST', path: '/auth/discord/refresh', description: 'Refresh token' }
    ],
    requirements: [
      'DISCORD_CLIENT_ID in .env',
      'DISCORD_CLIENT_SECRET in .env',
      'Redirect URI configured in Discord Developer Portal: http://localhost:3001/auth/discord/callback'
    ]
  },
  {
    provider: 'YouTube',
    emoji: '📺',
    type: 'oauth',
    description: 'Connects to YouTube/Google for access to user\'s YouTube playlists and subscriptions.',
    userSteps: [
      '1. User goes to Integrations page',
      '2. Clicks "Connect" on YouTube card',
      '3. Redirected to Google Sign-In',
      '4. User selects Google account',
      '5. User grants YouTube permissions',
      '6. Redirected back to app',
      '7. Profile and tokens saved',
      '8. Can access YouTube data!'
    ],
    technicalFlow: [
      'Frontend: window.location.href → /auth/youtube?user_id=xxx&user_email=xxx',
      'Backend: GET /auth/youtube → Redirect to Google OAuth',
      'Google: User authorizes → Redirect to /auth/youtube/callback?code=xxx',
      'Backend: POST to Google OAuth to exchange code for tokens',
      'Backend: GET user info from Google API',
      'Backend: Save to Supabase user_integrations table',
      'Backend: Redirect to frontend /integrations?youtube_connected=true'
    ],
    dataStored: [
      'access_token - For YouTube API requests',
      'refresh_token - For getting new access tokens',
      'provider_user_id - Google account ID',
      'provider_username - Google display name',
      'provider_email - Gmail address',
      'provider_avatar_url - Profile picture'
    ],
    endpoints: [
      { method: 'GET', path: '/auth/youtube', description: 'Start OAuth flow' },
      { method: 'GET', path: '/auth/youtube/callback', description: 'OAuth callback' },
      { method: 'POST', path: '/auth/youtube/refresh', description: 'Refresh token' }
    ],
    requirements: [
      'GOOGLE_CLIENT_ID in .env',
      'GOOGLE_CLIENT_SECRET in .env',
      'OAuth redirect URI in Google Cloud Console: http://localhost:3001/auth/youtube/callback'
    ]
  },
  {
    provider: 'Last.fm',
    emoji: '🎸',
    type: 'oauth',
    description: 'Connects to Last.fm for scrobbling (tracking what you listen to) and music recommendations.',
    userSteps: [
      '1. User goes to Integrations page',
      '2. Clicks "Connect" on Last.fm card',
      '3. Redirected to Last.fm authorization',
      '4. User logs in to Last.fm',
      '5. User grants permission',
      '6. Redirected back with token',
      '7. App exchanges token for session key',
      '8. Ready to scrobble!'
    ],
    technicalFlow: [
      'Frontend: window.location.href → /auth/lastfm?user_id=xxx',
      'Backend: GET /auth/lastfm → Redirect to Last.fm auth',
      'Last.fm: User authorizes → Redirect to frontend with token query param',
      'Frontend: Calls POST /auth/lastfm/session with token',
      'Backend: Uses Last.fm API to exchange token for session key',
      'Backend: Save session key and username to Supabase',
      'Return success to frontend'
    ],
    dataStored: [
      'provider_username - Last.fm username',
      'session_key - Permanent session key (stored in metadata)',
      'subscriber - Whether user has Last.fm Pro'
    ],
    endpoints: [
      { method: 'GET', path: '/auth/lastfm', description: 'Start auth flow' },
      { method: 'POST', path: '/auth/lastfm/session', description: 'Exchange token for session' }
    ],
    requirements: [
      'LASTFM_API_KEY in .env',
      'LASTFM_SHARED_SECRET in .env',
      'Callback URL configured in Last.fm API settings'
    ]
  },
  {
    provider: 'Telegram',
    emoji: '📱',
    type: 'bot',
    description: 'Connects to Telegram bot for receiving music notifications and controlling playback via chat.',
    userSteps: [
      '1. User opens Telegram app',
      '2. Searches for your bot (e.g., @MusicCompanionBot)',
      '3. Sends /start command to bot',
      '4. Bot returns a unique chat ID',
      '5. User copies the chat ID',
      '6. Pastes chat ID in the Music Companion app',
      '7. App saves the chat ID to Supabase',
      '8. Bot can now send notifications!'
    ],
    technicalFlow: [
      'User: Sends /start to Telegram bot',
      'Bot: Returns chat_id to user',
      'User: Enters chat_id in app\'s Integrations panel',
      'Frontend: Calls useIntegrations().connectTelegram(chatId)',
      'Frontend Hook: Saves to Supabase user_integrations table',
      'Backend: Uses TELEGRAM_BOT_TOKEN to send messages to chat_id'
    ],
    dataStored: [
      'provider_user_id - Telegram chat ID',
      'provider_username - Telegram username (optional)',
      'chat_id - Same as provider_user_id (in metadata)'
    ],
    endpoints: [
      { method: 'N/A', path: 'useIntegrations().connectTelegram()', description: 'Frontend hook saves directly to Supabase' }
    ],
    requirements: [
      'TELEGRAM_BOT_TOKEN in .env',
      'Telegram Bot created via @BotFather',
      'User must message the bot first to get chat ID'
    ]
  }
];

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function checkEndpoint(method: string, path: string): Promise<{ status: number; ok: boolean }> {
  try {
    const url = `${BACKEND_URL}${path}`;
    let response;
    
    if (method === 'GET') {
      response = await axios.get(url, { 
        maxRedirects: 0,
        validateStatus: () => true 
      });
    } else {
      response = await axios.post(url, {}, { 
        validateStatus: () => true 
      });
    }
    
    // 302 (redirect) or 400 (missing params) means endpoint exists
    const ok = [302, 400, 401, 503].includes(response.status);
    return { status: response.status, ok };
  } catch (err: any) {
    if (err.response?.status === 302) {
      return { status: 302, ok: true };
    }
    return { status: 0, ok: false };
  }
}

async function testIntegration(flow: IntegrationFlow): Promise<IntegrationFlow> {
  for (const endpoint of flow.endpoints) {
    if (endpoint.method === 'N/A') continue;
    
    const result = await checkEndpoint(endpoint.method, endpoint.path);
    if (!result.ok) {
      flow.status = 'ERROR';
      return flow;
    }
  }
  flow.status = 'OK';
  return flow;
}

// ============================================================================
// PRINT FUNCTIONS
// ============================================================================

function printIntegration(flow: IntegrationFlow) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold(`   ${flow.emoji}  ${flow.provider.toUpperCase()} INTEGRATION`));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════════════\n'));
  
  const statusIcon = flow.status === 'OK' ? chalk.green('✅ CONFIGURED') : 
                     flow.status === 'ERROR' ? chalk.red('❌ ERROR') : chalk.yellow('⚠️ UNKNOWN');
  console.log(`${chalk.bold('Status:')} ${statusIcon}`);
  console.log(`${chalk.bold('Type:')} ${flow.type.toUpperCase()}`);
  console.log(`${chalk.bold('Description:')} ${flow.description}\n`);
  
  console.log(chalk.yellow('📝 HOW USERS CONNECT:'));
  flow.userSteps.forEach(step => console.log(`   ${step}`));
  
  console.log(chalk.yellow('\n🔧 TECHNICAL FLOW:'));
  flow.technicalFlow.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step}`);
  });
  
  console.log(chalk.yellow('\n💾 DATA STORED IN SUPABASE:'));
  flow.dataStored.forEach(item => console.log(`   • ${item}`));
  
  console.log(chalk.yellow('\n🌐 API ENDPOINTS:'));
  flow.endpoints.forEach(ep => {
    console.log(`   ${chalk.blue(ep.method.padEnd(6))} ${ep.path.padEnd(35)} ${chalk.gray(ep.description)}`);
  });
  
  console.log(chalk.yellow('\n📋 REQUIREMENTS:'));
  flow.requirements.forEach(req => console.log(`   • ${req}`));
}

function printDiagram() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold('   🔄 OAUTH FLOW DIAGRAM'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════════════\n'));
  
  console.log(chalk.white(`
  ┌─────────────┐     1. Click Connect      ┌─────────────┐
  │             │  ─────────────────────►   │             │
  │   FRONTEND  │                           │   BACKEND   │
  │  (React)    │  ◄─────────────────────   │  (Express)  │
  │             │     8. Redirect with      │             │
  └─────────────┘        success flag       └─────────────┘
        │                                         │
        │                                         │ 2. Redirect to
        │                                         │    Provider
        │                                         ▼
        │                                   ┌─────────────┐
        │                                   │             │
        │                                   │   PROVIDER  │
        │                                   │  (Spotify,  │
        │                                   │   Discord,  │
        │                                   │   etc.)     │
        │                                   │             │
        │                                   └─────────────┘
        │                                         │
        │                 3. User logs in         │
        │                    and authorizes       │
        │                                         │
        │                                         ▼
        │                                   ┌─────────────┐
        │                                   │   CALLBACK  │
        │                                   │    /auth/   │
        │           4. Exchange code        │  provider/  │
        │              for tokens           │   callback  │
        │                                   └─────────────┘
        │                                         │
        │                                         │ 5. Get user profile
        │                                         │ 6. Save to Supabase
        │                                         │ 7. Generate redirect
        │                                         │
        │                                         ▼
        │                                   ┌─────────────┐
        └──────────────────────────────────►│  SUPABASE   │
                        Reads saved         │             │
                        integration         │  Database   │
                                            └─────────────┘
  `));
}

function printSummaryTable(flows: IntegrationFlow[]) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold('   📊 INTEGRATION STATUS SUMMARY'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════════════\n'));
  
  console.log(chalk.gray('┌────────────┬──────────┬─────────────┬─────────────────────────────────────┐'));
  console.log(chalk.gray('│ Provider   │ Status   │ Type        │ Main Endpoint                       │'));
  console.log(chalk.gray('├────────────┼──────────┼─────────────┼─────────────────────────────────────┤'));
  
  flows.forEach(flow => {
    const statusIcon = flow.status === 'OK' ? '✅' : flow.status === 'ERROR' ? '❌' : '⚠️';
    const mainEndpoint = flow.endpoints[0]?.path || 'N/A';
    console.log(
      chalk.gray('│ ') + 
      `${flow.emoji} ${flow.provider.padEnd(8)}`.padEnd(11) + 
      chalk.gray('│ ') + 
      `${statusIcon}       `.slice(0, 9) + 
      chalk.gray('│ ') + 
      `${flow.type.padEnd(12)}` + 
      chalk.gray('│ ') + 
      `${mainEndpoint.padEnd(36)}` + 
      chalk.gray('│')
    );
  });
  
  console.log(chalk.gray('└────────────┴──────────┴─────────────┴─────────────────────────────────────┘'));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(chalk.bold.magenta('\n╔═══════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║           🔐  OAUTH INTEGRATION FLOW DOCUMENTATION  🔐                    ║'));
  console.log(chalk.bold.magenta('╚═══════════════════════════════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.gray(`Backend URL: ${BACKEND_URL}`));
  console.log(chalk.gray(`Frontend URL: ${FRONTEND_URL}`));
  console.log(chalk.gray(`Time: ${new Date().toISOString()}\n`));
  
  // Print the OAuth flow diagram
  printDiagram();
  
  // Test each integration
  console.log(chalk.cyan('\n🔍 Testing integration endpoints...'));
  const testedFlows: IntegrationFlow[] = [];
  
  for (const flow of INTEGRATION_FLOWS) {
    const tested = await testIntegration(flow);
    testedFlows.push(tested);
    const icon = tested.status === 'OK' ? '✅' : '❌';
    console.log(`   ${icon} ${flow.emoji} ${flow.provider}`);
  }
  
  // Print summary table
  printSummaryTable(testedFlows);
  
  // Print detailed info for each integration
  for (const flow of testedFlows) {
    printIntegration(flow);
  }
  
  // Final notes
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold('   📖 HOW TO USE THIS IN YOUR APP'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════════════\n'));
  
  console.log(chalk.white(`
  1. ${chalk.bold('To connect a user to Spotify/Discord/YouTube:')}
     
     // In your React component:
     const { connectOAuth } = useIntegrations();
     
     // When user clicks "Connect Spotify":
     await connectOAuth('spotify');
     // This redirects to: ${BACKEND_URL}/auth/spotify?user_id=xxx&user_email=xxx
     
  2. ${chalk.bold('To connect Telegram:')}
     
     const { connectTelegram } = useIntegrations();
     
     // After user provides their chat ID:
     await connectTelegram(chatId, username);
     
  3. ${chalk.bold('To check if a user is connected:')}
     
     const { isConnected } = useIntegrations();
     
     if (isConnected('spotify')) {
       console.log('Spotify is connected!');
     }
     
  4. ${chalk.bold('To disconnect:')}
     
     const { disconnect } = useIntegrations();
     await disconnect('spotify');
  `));
  
  console.log(chalk.green('\n✅ Documentation complete!'));
}

main().catch(console.error);
