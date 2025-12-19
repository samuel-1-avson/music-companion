/**
 * Integration Test Script
 * 
 * Tests the built-in integrations: Spotify, Discord, Telegram, Last.fm, YouTube
 * Run with: npx ts-node scripts/test-integrations.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

// Configuration
const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Test results
interface TestResult {
  service: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Helper functions
function log(type: 'info' | 'success' | 'error' | 'warn', message: string) {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warn: chalk.yellow,
  };
  console.log(colors[type](`[${type.toUpperCase()}] ${message}`));
}

function addResult(service: string, test: string, status: TestResult['status'], message: string, details?: any) {
  results.push({ service, test, status, message, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️';
  log(status === 'PASS' ? 'success' : status === 'FAIL' ? 'error' : status === 'WARN' ? 'warn' : 'info', 
    `${icon} [${service}] ${test}: ${message}`);
}

// ============================================================================
// BACKEND HEALTH CHECK
// ============================================================================
async function testBackendHealth() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🔧 BACKEND HEALTH CHECK'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    const { status, services } = response.data;
    
    addResult('Backend', 'Server Status', status === 'ok' ? 'PASS' : 'FAIL', 
      status === 'ok' ? 'Server is running' : 'Server returned non-ok status');
    
    return services || {};
  } catch (err: any) {
    addResult('Backend', 'Server Status', 'FAIL', 
      `Cannot reach backend at ${BACKEND_URL}: ${err.message}`);
    return null;
  }
}

// ============================================================================
// SPOTIFY INTEGRATION TESTS
// ============================================================================
async function testSpotifyIntegration(isConfigured: boolean) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🎵 SPOTIFY INTEGRATION TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Test 1: Configuration Check
  addResult('Spotify', 'Configuration', isConfigured ? 'PASS' : 'WARN', 
    isConfigured ? 'Client ID and Secret are configured' : 'SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set in .env');

  if (!isConfigured) {
    addResult('Spotify', 'OAuth Endpoint', 'SKIP', 'Skipped - Spotify not configured');
    addResult('Spotify', 'API Access', 'SKIP', 'Skipped - Spotify not configured');
    return;
  }

  // Test 2: OAuth Endpoint Availability
  try {
    const response = await axios.get(`${BACKEND_URL}/auth/spotify`, { 
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 302
    });
    
    // Should redirect to Spotify
    if (response.status === 302 || response.headers.location?.includes('accounts.spotify.com')) {
      addResult('Spotify', 'OAuth Endpoint', 'PASS', 'Redirects correctly to Spotify authorization');
    } else {
      addResult('Spotify', 'OAuth Endpoint', 'PASS', 'OAuth endpoint is accessible');
    }
  } catch (err: any) {
    if (err.response?.status === 302) {
      addResult('Spotify', 'OAuth Endpoint', 'PASS', 'Redirects to Spotify authorization');
    } else {
      addResult('Spotify', 'OAuth Endpoint', 'FAIL', `OAuth endpoint error: ${err.message}`);
    }
  }

  // Test 3: Verify Integration Endpoint
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/verify-integration`, {
      user_id: 'test',
      provider: 'spotify',
      code: 'test'
    }, { validateStatus: () => true });
    
    // Expecting 400 (invalid code) or 503 (supabase not configured) - but endpoint exists
    if (response.status === 400 || response.status === 503) {
      addResult('Spotify', 'Verification Endpoint', 'PASS', 'Endpoint is accessible');
    } else {
      addResult('Spotify', 'Verification Endpoint', 'WARN', `Unexpected response: ${response.status}`);
    }
  } catch (err: any) {
    addResult('Spotify', 'Verification Endpoint', 'FAIL', `Endpoint error: ${err.message}`);
  }

  // Test 4: Token Refresh Endpoint
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/spotify/refresh`, {
      refresh_token: 'invalid_test_token'
    }, { validateStatus: () => true });
    
    // Expecting 401 (invalid token) but endpoint should exist
    if (response.status === 401 || response.status === 400) {
      addResult('Spotify', 'Token Refresh Endpoint', 'PASS', 'Endpoint is accessible');
    } else {
      addResult('Spotify', 'Token Refresh Endpoint', 'WARN', `Unexpected response: ${response.status}`);
    }
  } catch (err: any) {
    addResult('Spotify', 'Token Refresh Endpoint', 'FAIL', `Endpoint error: ${err.message}`);
  }
}

// ============================================================================
// DISCORD INTEGRATION TESTS
// ============================================================================
async function testDiscordIntegration(isConfigured: boolean) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   💬 DISCORD INTEGRATION TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Test 1: Configuration Check
  addResult('Discord', 'Configuration', isConfigured ? 'PASS' : 'WARN', 
    isConfigured ? 'Client ID and Secret are configured' : 'DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET not set in .env');

  if (!isConfigured) {
    addResult('Discord', 'OAuth Endpoint', 'SKIP', 'Skipped - Discord not configured');
    addResult('Discord', 'Rich Presence', 'SKIP', 'Skipped - Discord not configured');
    return;
  }

  // Test 2: OAuth Endpoint Availability
  try {
    const response = await axios.get(`${BACKEND_URL}/auth/discord?user_id=test&user_email=test@test.com`, { 
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 302
    });
    
    if (response.status === 302 || response.headers.location?.includes('discord.com')) {
      addResult('Discord', 'OAuth Endpoint', 'PASS', 'Redirects correctly to Discord authorization');
    } else {
      addResult('Discord', 'OAuth Endpoint', 'PASS', 'OAuth endpoint is accessible');
    }
  } catch (err: any) {
    if (err.response?.status === 302) {
      addResult('Discord', 'OAuth Endpoint', 'PASS', 'Redirects to Discord authorization');
    } else {
      addResult('Discord', 'OAuth Endpoint', 'FAIL', `OAuth endpoint error: ${err.message}`);
    }
  }

  // Test 3: Rich Presence Status Check
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    const discordConfigured = response.data?.services?.discord;
    
    addResult('Discord', 'Rich Presence Config', discordConfigured ? 'PASS' : 'WARN', 
      discordConfigured 
        ? 'Discord Rich Presence is configured (requires Discord desktop app running)' 
        : 'Discord Rich Presence not configured in backend');
  } catch (err: any) {
    addResult('Discord', 'Rich Presence Config', 'WARN', 'Could not check Rich Presence status');
  }
}

// ============================================================================
// TELEGRAM INTEGRATION TESTS
// ============================================================================
async function testTelegramIntegration() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   📱 TELEGRAM INTEGRATION TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Check if Telegram bot is configured
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  
  addResult('Telegram', 'Bot Token Configuration', telegramBotToken ? 'PASS' : 'WARN', 
    telegramBotToken 
      ? 'TELEGRAM_BOT_TOKEN is configured' 
      : 'TELEGRAM_BOT_TOKEN not set - Telegram notifications will not work');

  if (!telegramBotToken) {
    addResult('Telegram', 'Bot API Access', 'SKIP', 'Skipped - Telegram bot token not configured');
    return;
  }

  // Test Telegram Bot API
  try {
    const response = await axios.get(`https://api.telegram.org/bot${telegramBotToken}/getMe`, { timeout: 5000 });
    
    if (response.data?.ok) {
      addResult('Telegram', 'Bot API Access', 'PASS', 
        `Bot connected: @${response.data.result.username}`);
    } else {
      addResult('Telegram', 'Bot API Access', 'FAIL', 'Invalid response from Telegram API');
    }
  } catch (err: any) {
    addResult('Telegram', 'Bot API Access', 'FAIL', 
      `Telegram API error: ${err.response?.data?.description || err.message}`);
  }
}

// ============================================================================
// LAST.FM INTEGRATION TESTS
// ============================================================================
async function testLastFmIntegration(isConfigured: boolean) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🎸 LAST.FM INTEGRATION TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Test 1: Configuration Check
  addResult('Last.fm', 'Configuration', isConfigured ? 'PASS' : 'WARN', 
    isConfigured ? 'API Key and Shared Secret are configured' : 'LASTFM_API_KEY or LASTFM_SHARED_SECRET not set in .env');

  if (!isConfigured) {
    addResult('Last.fm', 'Auth Endpoint', 'SKIP', 'Skipped - Last.fm not configured');
    addResult('Last.fm', 'API Access', 'SKIP', 'Skipped - Last.fm not configured');
    return;
  }

  // Test 2: Auth Endpoint Availability
  try {
    const response = await axios.get(`${BACKEND_URL}/auth/lastfm?user_id=test`, { 
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 302
    });
    
    if (response.status === 302 || response.headers.location?.includes('last.fm')) {
      addResult('Last.fm', 'Auth Endpoint', 'PASS', 'Redirects correctly to Last.fm');
    } else {
      addResult('Last.fm', 'Auth Endpoint', 'PASS', 'Auth endpoint is accessible');
    }
  } catch (err: any) {
    if (err.response?.status === 302) {
      addResult('Last.fm', 'Auth Endpoint', 'PASS', 'Redirects to Last.fm');
    } else {
      addResult('Last.fm', 'Auth Endpoint', 'FAIL', `Auth endpoint error: ${err.message}`);
    }
  }

  // Test 3: API Access (public endpoint test)
  const lastfmApiKey = process.env.LASTFM_API_KEY;
  if (lastfmApiKey) {
    try {
      const response = await axios.get(
        `https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=${lastfmApiKey}&format=json&limit=1`,
        { timeout: 5000 }
      );
      
      if (response.data?.artists) {
        addResult('Last.fm', 'API Access', 'PASS', 'Successfully queried Last.fm API');
      } else {
        addResult('Last.fm', 'API Access', 'WARN', 'API responded but with unexpected format');
      }
    } catch (err: any) {
      addResult('Last.fm', 'API Access', 'FAIL', 
        `Last.fm API error: ${err.response?.data?.message || err.message}`);
    }
  }
}

// ============================================================================
// YOUTUBE INTEGRATION TESTS
// ============================================================================
async function testYouTubeIntegration(isConfigured: boolean) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   📺 YOUTUBE INTEGRATION TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Test 1: Configuration Check
  addResult('YouTube', 'OAuth Configuration', isConfigured ? 'PASS' : 'WARN', 
    isConfigured ? 'Google Client ID and Secret are configured' : 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in .env');

  const apiKey = process.env.YOUTUBE_API_KEY;
  addResult('YouTube', 'API Key Configuration', apiKey ? 'PASS' : 'WARN', 
    apiKey ? 'YOUTUBE_API_KEY is configured' : 'YOUTUBE_API_KEY not set - Search may be limited');

  // Test 2: Music Search API (via backend)
  try {
    const response = await axios.get(`${BACKEND_URL}/api/music/search`, {
      params: { q: 'test song', limit: 1 },
      timeout: 10000
    });
    
    if (response.data?.success && response.data?.data) {
      addResult('YouTube', 'Music Search API', 'PASS', 
        `Search working - found ${response.data.data.length} result(s)`);
    } else if (response.data?.success) {
      addResult('YouTube', 'Music Search API', 'PASS', 'Search endpoint is working');
    } else {
      addResult('YouTube', 'Music Search API', 'WARN', 'Search returned but with unexpected format');
    }
  } catch (err: any) {
    addResult('YouTube', 'Music Search API', 'FAIL', 
      `Music search error: ${err.response?.data?.error || err.message}`);
  }
}

// ============================================================================
// SUPABASE INTEGRATION TESTS
// ============================================================================
async function testSupabaseIntegration() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🗄️ SUPABASE DATABASE TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Test 1: Configuration Check
  addResult('Supabase', 'Configuration', supabaseUrl && supabaseKey ? 'PASS' : 'FAIL', 
    supabaseUrl && supabaseKey 
      ? 'Supabase URL and Anon Key are configured' 
      : 'SUPABASE_URL or SUPABASE_ANON_KEY not set - Auth & data features will not work');

  if (!supabaseUrl || !supabaseKey) {
    addResult('Supabase', 'API Connection', 'SKIP', 'Skipped - Supabase not configured');
    return;
  }

  // Test 2: API Connection
  try {
    const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      timeout: 5000
    });
    
    addResult('Supabase', 'API Connection', 'PASS', 'Successfully connected to Supabase');
  } catch (err: any) {
    // 404 or 400 is fine - means we reached supabase but need proper endpoint
    if (err.response?.status === 404 || err.response?.status === 400) {
      addResult('Supabase', 'API Connection', 'PASS', 'Supabase is reachable');
    } else {
      addResult('Supabase', 'API Connection', 'FAIL', 
        `Supabase connection error: ${err.response?.data?.message || err.message}`);
    }
  }
}

// ============================================================================
// GEMINI AI INTEGRATION TESTS
// ============================================================================
async function testGeminiIntegration(isConfigured: boolean) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🤖 GEMINI AI INTEGRATION TESTS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Test 1: Configuration Check
  addResult('Gemini', 'Configuration', isConfigured ? 'PASS' : 'FAIL', 
    isConfigured ? 'GEMINI_API_KEY is configured' : 'GEMINI_API_KEY not set - AI features will not work');

  if (!isConfigured) {
    addResult('Gemini', 'AI Endpoint', 'SKIP', 'Skipped - Gemini not configured');
    return;
  }

  // Test 2: AI Greeting Endpoint (simple test that works without rate limiting)
  try {
    const response = await axios.get(`${BACKEND_URL}/api/ai/greeting?name=Test`, { 
      timeout: 15000,
      validateStatus: () => true 
    });
    
    if (response.status === 200 && response.data?.success) {
      addResult('Gemini', 'AI Greeting Endpoint', 'PASS', 'AI greeting is working');
    } else if (response.status === 429) {
      addResult('Gemini', 'AI Greeting Endpoint', 'WARN', 'API rate limited (429) - but endpoint is working');
    } else if (response.status === 503) {
      addResult('Gemini', 'AI Greeting Endpoint', 'WARN', 'Gemini API not configured on server');
    } else {
      addResult('Gemini', 'AI Greeting Endpoint', 'WARN', `Endpoint responded with status ${response.status}`);
    }
  } catch (err: any) {
    addResult('Gemini', 'AI Greeting Endpoint', 'FAIL', 
      `AI endpoint error: ${err.response?.data?.error || err.message}`);
  }

  // Test 3: AI Playlist Endpoint
  try {
    const response = await axios.post(`${BACKEND_URL}/api/ai/playlist`, {
      prompt: 'test'
    }, { 
      timeout: 15000,
      validateStatus: () => true 
    });
    
    if (response.status === 200 && response.data?.success) {
      addResult('Gemini', 'AI Playlist Endpoint', 'PASS', 'AI playlist generation is working');
    } else if (response.status === 429) {
      addResult('Gemini', 'AI Playlist Endpoint', 'WARN', 'API rate limited (429) - but endpoint is accessible');
    } else if (response.status === 500) {
      addResult('Gemini', 'AI Playlist Endpoint', 'WARN', 'Gemini API error (may be rate limited)');
    } else {
      addResult('Gemini', 'AI Playlist Endpoint', 'PASS', 'AI playlist endpoint is accessible');
    }
  } catch (err: any) {
    addResult('Gemini', 'AI Playlist Endpoint', 'FAIL', 
      `AI endpoint error: ${err.response?.data?.error || err.message}`);
  }
}

// ============================================================================
// PRINT SUMMARY
// ============================================================================
function printSummary() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   📊 INTEGRATION TEST SUMMARY'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const services = [...new Set(results.map(r => r.service))];
  
  for (const service of services) {
    const serviceResults = results.filter(r => r.service === service);
    const passed = serviceResults.filter(r => r.status === 'PASS').length;
    const failed = serviceResults.filter(r => r.status === 'FAIL').length;
    const warned = serviceResults.filter(r => r.status === 'WARN').length;
    const skipped = serviceResults.filter(r => r.status === 'SKIP').length;
    
    let icon = '✅';
    let color = chalk.green;
    if (failed > 0) { icon = '❌'; color = chalk.red; }
    else if (warned > 0) { icon = '⚠️'; color = chalk.yellow; }
    else if (skipped === serviceResults.length) { icon = '⏭️'; color = chalk.gray; }
    
    console.log(color(`${icon} ${service.padEnd(12)} - ${passed} passed, ${failed} failed, ${warned} warnings, ${skipped} skipped`));
  }

  const totalPassed = results.filter(r => r.status === 'PASS').length;
  const totalFailed = results.filter(r => r.status === 'FAIL').length;
  const totalWarned = results.filter(r => r.status === 'WARN').length;
  
  console.log(chalk.cyan('\n───────────────────────────────────────────────────'));
  console.log(chalk.bold(`Total: ${totalPassed} passed, ${totalFailed} failed, ${totalWarned} warnings`));
  console.log(chalk.cyan('───────────────────────────────────────────────────\n'));

  if (totalFailed > 0) {
    console.log(chalk.red('❌ Some critical integrations are failing. Check the configuration above.'));
  } else if (totalWarned > 0) {
    console.log(chalk.yellow('⚠️ Some integrations have warnings but should still work.'));
  } else {
    console.log(chalk.green('✅ All configured integrations are working correctly!'));
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log(chalk.bold.magenta('\n╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║       🎵 MUSIC COMPANION INTEGRATION TEST SUITE 🎵           ║'));
  console.log(chalk.bold.magenta('╚═══════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.gray(`Backend URL: ${BACKEND_URL}`));
  console.log(chalk.gray(`Frontend URL: ${FRONTEND_URL}`));
  console.log(chalk.gray(`Time: ${new Date().toISOString()}\n`));

  // Run health check first
  const services = await testBackendHealth();
  
  if (services === null) {
    console.log(chalk.red('\n❌ Cannot reach backend server. Make sure it is running.'));
    console.log(chalk.gray('   Run: cd backend && npm run dev\n'));
    printSummary();
    process.exit(1);
  }

  // Run all integration tests
  await testSpotifyIntegration(services.spotify || false);
  await testDiscordIntegration(services.discord || false);
  await testTelegramIntegration();
  await testLastFmIntegration(services.lastfm || false);
  await testYouTubeIntegration(services.youtube || false);
  await testSupabaseIntegration();
  await testGeminiIntegration(services.gemini || false);

  // Print summary
  printSummary();
}

main().catch(console.error);
