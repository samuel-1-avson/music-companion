/**
 * Integration Verification Script
 * Tests all OAuth integrations and service connections
 * 
 * Run: npx ts-node scripts/verify-integrations.ts
 */

import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
}

const results: TestResult[] = [];

function addResult(category: string, name: string, status: TestResult['status'], message: string) {
  results.push({ category, name, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '⏭️';
  const colorFn = status === 'PASS' ? chalk.green : status === 'FAIL' ? chalk.red : status === 'WARN' ? chalk.yellow : chalk.gray;
  console.log(`  ${icon} ${colorFn(name)}: ${message}`);
}

// ============================================================================
// ENV CHECKS
// ============================================================================
async function checkEnvVariables() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🔐 ENVIRONMENT VARIABLES CHECK'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const requiredVars = {
    // Spotify
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
    
    // Discord
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    
    // Google/YouTube
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    
    // Last.fm
    LASTFM_API_KEY: process.env.LASTFM_API_KEY,
    
    // Gemini
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    
    // Supabase
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (value && value.length > 0) {
      const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
      addResult('ENV', key, 'PASS', `Set (${masked})`);
    } else {
      addResult('ENV', key, 'FAIL', 'Not set or empty');
    }
  }
}

// ============================================================================
// BACKEND HEALTH CHECK
// ============================================================================
async function checkBackendHealth() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🏥 BACKEND HEALTH CHECK'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    
    if (response.data.status === 'ok') {
      addResult('Backend', 'Server Status', 'PASS', 'Backend is running');
      
      // Check individual services
      const services = response.data.services || {};
      for (const [service, isConfigured] of Object.entries(services)) {
        addResult('Backend', `Service: ${service}`, isConfigured ? 'PASS' : 'WARN', 
          isConfigured ? 'Configured' : 'Not configured');
      }
    }
  } catch (err: any) {
    addResult('Backend', 'Server Status', 'FAIL', `Backend not reachable: ${err.message}`);
    console.log(chalk.red('\n⚠️  Backend is not running. Start it with: cd backend && npm run dev\n'));
  }
}

// ============================================================================
// OAUTH ENDPOINT CHECKS
// ============================================================================
async function checkOAuthEndpoints() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🔑 OAUTH ENDPOINT CHECKS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const endpoints = [
    { name: 'Spotify OAuth', path: '/auth/spotify', expectRedirect: true },
    { name: 'Discord OAuth', path: '/auth/discord', expectRedirect: true },
    { name: 'YouTube OAuth', path: '/auth/youtube', expectRedirect: true },
    { name: 'Last.fm OAuth', path: '/auth/lastfm', expectRedirect: true },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${BACKEND_URL}${endpoint.path}`, {
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
        timeout: 5000,
      });

      if (response.status === 302 || response.status === 301) {
        const location = response.headers.location || '';
        addResult('OAuth', endpoint.name, 'PASS', `Redirects to provider (${location.substring(0, 50)}...)`);
      } else if (response.status === 503) {
        addResult('OAuth', endpoint.name, 'WARN', 'Provider not configured in .env');
      } else {
        addResult('OAuth', endpoint.name, 'WARN', `Unexpected status: ${response.status}`);
      }
    } catch (err: any) {
      if (err.response?.status === 302) {
        addResult('OAuth', endpoint.name, 'PASS', 'Redirects to provider');
      } else {
        addResult('OAuth', endpoint.name, 'FAIL', `Error: ${err.message}`);
      }
    }
  }
}

// ============================================================================
// TOKEN REFRESH ENDPOINTS
// ============================================================================
async function checkTokenRefreshEndpoints() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🔄 TOKEN REFRESH ENDPOINT CHECKS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Test Spotify refresh endpoint (with invalid token, just checking it exists)
  try {
    const response = await axios.post(`${BACKEND_URL}/auth/spotify/refresh`, 
      { refresh_token: 'test_invalid_token' },
      { validateStatus: () => true, timeout: 5000 }
    );

    if (response.status === 400 || response.status === 401) {
      addResult('Token Refresh', 'Spotify', 'PASS', 'Endpoint exists (rejected test token as expected)');
    } else {
      addResult('Token Refresh', 'Spotify', 'WARN', `Unexpected response: ${response.status}`);
    }
  } catch (err: any) {
    addResult('Token Refresh', 'Spotify', 'FAIL', `Error: ${err.message}`);
  }
}

// ============================================================================
// API SERVICE CHECKS
// ============================================================================
async function checkAPIServices() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🎵 API SERVICE CHECKS'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  // Spotify Search (uses system token)
  try {
    const response = await axios.get(`${BACKEND_URL}/api/music/search`, {
      params: { q: 'test', provider: 'SPOTIFY', limit: 1 },
      timeout: 15000,
    });
    
    if (response.data.success && response.data.data?.length > 0) {
      addResult('API', 'Spotify Search', 'PASS', `Found: ${response.data.data[0].title}`);
    } else if (response.data.success) {
      addResult('API', 'Spotify Search', 'WARN', 'No results found');
    } else {
      addResult('API', 'Spotify Search', 'FAIL', response.data.error || 'Unknown error');
    }
  } catch (err: any) {
    addResult('API', 'Spotify Search', 'FAIL', err.response?.data?.error || err.message);
  }

  // YouTube Search
  try {
    const response = await axios.get(`${BACKEND_URL}/api/music/search`, {
      params: { q: 'test', provider: 'YOUTUBE', limit: 1 },
      timeout: 15000,
    });
    
    if (response.data.success && response.data.data?.length > 0) {
      addResult('API', 'YouTube Search', 'PASS', `Found: ${response.data.data[0].title}`);
    } else {
      addResult('API', 'YouTube Search', 'WARN', 'No results or fallback used');
    }
  } catch (err: any) {
    addResult('API', 'YouTube Search', 'FAIL', err.message);
  }

  // Last.fm Top Charts
  try {
    const response = await axios.get(`${BACKEND_URL}/api/music/lastfm/top`, {
      params: { limit: 1 },
      timeout: 10000,
    });
    
    if (response.data.success && response.data.data?.length > 0) {
      addResult('API', 'Last.fm Charts', 'PASS', `Top track: ${response.data.data[0].title}`);
    } else {
      addResult('API', 'Last.fm Charts', 'WARN', 'No results');
    }
  } catch (err: any) {
    addResult('API', 'Last.fm Charts', 'FAIL', err.response?.data?.error || err.message);
  }

  // Last.fm Tags
  try {
    const response = await axios.get(`${BACKEND_URL}/api/music/lastfm/tags`, {
      params: { limit: 3 },
      timeout: 10000,
    });
    
    if (response.data.success && response.data.data?.length > 0) {
      const tags = response.data.data.map((t: any) => t.name).join(', ');
      addResult('API', 'Last.fm Tags', 'PASS', `Tags: ${tags}`);
    } else {
      addResult('API', 'Last.fm Tags', 'WARN', 'No tags returned');
    }
  } catch (err: any) {
    addResult('API', 'Last.fm Tags', 'FAIL', err.response?.data?.error || err.message);
  }

  // Gemini AI
  try {
    const response = await axios.get(`${BACKEND_URL}/api/ai/greeting`, {
      timeout: 15000,
    });
    
    if (response.data.success) {
      addResult('API', 'Gemini AI', 'PASS', 'Greeting generated successfully');
    } else {
      addResult('API', 'Gemini AI', 'WARN', response.data.error || 'Unknown issue');
    }
  } catch (err: any) {
    if (err.response?.status === 429) {
      addResult('API', 'Gemini AI', 'WARN', 'Rate limited (API working but quota exceeded)');
    } else {
      addResult('API', 'Gemini AI', 'FAIL', err.response?.data?.error || err.message);
    }
  }
}

// ============================================================================
// SUPABASE CONNECTION CHECK
// ============================================================================
async function checkSupabase() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   🗄️  SUPABASE CONNECTION CHECK'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    addResult('Supabase', 'Configuration', 'FAIL', 'Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    return;
  }

  try {
    // Test REST API health
    const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      timeout: 10000,
    });

    addResult('Supabase', 'REST API', 'PASS', 'Connected successfully');
  } catch (err: any) {
    if (err.response?.status === 400) {
      // 400 means API is reachable but request was bad (expected for root endpoint)
      addResult('Supabase', 'REST API', 'PASS', 'API reachable');
    } else {
      addResult('Supabase', 'REST API', 'FAIL', err.message);
    }
  }

  // Test if user_integrations table exists
  try {
    const response = await axios.get(`${supabaseUrl}/rest/v1/user_integrations?limit=0`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      timeout: 10000,
    });

    addResult('Supabase', 'user_integrations table', 'PASS', 'Table exists and accessible');
  } catch (err: any) {
    if (err.response?.status === 404) {
      addResult('Supabase', 'user_integrations table', 'FAIL', 'Table not found - run migrations');
    } else {
      addResult('Supabase', 'user_integrations table', 'WARN', err.message);
    }
  }
}

// ============================================================================
// PRINT SUMMARY
// ============================================================================
function printSummary() {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════'));
  console.log(chalk.cyan('   📊 VERIFICATION SUMMARY'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════\n'));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`  ${chalk.green('✅ Passed:')} ${passed}`);
  console.log(`  ${chalk.red('❌ Failed:')} ${failed}`);
  console.log(`  ${chalk.yellow('⚠️  Warnings:')} ${warned}`);
  console.log(`  ${chalk.gray('⏭️  Skipped:')} ${skipped}`);
  console.log(`  ${chalk.blue('📋 Total:')} ${results.length}`);

  if (failed > 0) {
    console.log(chalk.red('\n❌ Some checks failed. Review the issues above.\n'));
  } else if (warned > 0) {
    console.log(chalk.yellow('\n⚠️  All critical checks passed, but some warnings need attention.\n'));
  } else {
    console.log(chalk.green('\n🎉 All checks passed! Integrations are ready.\n'));
  }

  // Print action items for failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log(chalk.red('═══════════════════════════════════════════════════'));
    console.log(chalk.red('   🛠️  ACTION REQUIRED'));
    console.log(chalk.red('═══════════════════════════════════════════════════\n'));
    
    failures.forEach((f, i) => {
      console.log(chalk.red(`  ${i + 1}. [${f.category}] ${f.name}`));
      console.log(chalk.gray(`     Issue: ${f.message}\n`));
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log(chalk.bold.cyan('\n🔍 Music Companion - Integration Verification\n'));
  console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}`));
  console.log(chalk.gray(`Backend URL: ${BACKEND_URL}`));
  console.log(chalk.gray(`Frontend URL: ${FRONTEND_URL}`));

  await checkEnvVariables();
  await checkBackendHealth();
  await checkOAuthEndpoints();
  await checkTokenRefreshEndpoints();
  await checkAPIServices();
  await checkSupabase();
  printSummary();
}

main().catch(console.error);
