/**
 * OAuth Integration Test Script
 * 
 * Tests the complete OAuth flow including:
 * - OAuth initiation URLs 
 * - Token endpoints
 * - Refresh endpoints
 * - Disconnect endpoints
 * 
 * Usage: npx tsx backend/scripts/test-oauth-flows.ts
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://music-companion-production.up.railway.app';
const FRONTEND_URL = 'https://music-companion-seven.vercel.app';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true, message: 'OK' });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, message: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function fetchJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, headers: response.headers };
}

async function checkRedirect(url: string) {
  const response = await fetch(url, { redirect: 'manual' });
  return { 
    status: response.status, 
    location: response.headers.get('location') 
  };
}

// ==================== TESTS ====================

async function runTests() {
  console.log('\n🧪 OAuth Integration Tests');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Frontend: ${FRONTEND_URL}\n`);

  // ===== HEALTH & STATUS =====
  await test('Backend health check', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/health`);
    if (status !== 200) throw new Error(`Status ${status}`);
    if (data.status !== 'ok') throw new Error('Health not ok');
  });

  await test('Auth status endpoint returns configured providers', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/status`);
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.success) throw new Error('Failed');
    console.log('   Configured:', Object.entries(data.data || {}).filter(([k,v]) => v).map(([k]) => k).join(', '));
  });

  // ===== SPOTIFY =====
  console.log('\n--- Spotify OAuth ---');
  
  await test('Spotify OAuth URL generates correctly', async () => {
    const { status, location } = await checkRedirect(
      `${BACKEND_URL}/auth/spotify?user_id=test-user&user_email=test@example.com`
    );
    if (status !== 302) throw new Error(`Expected 302 redirect, got ${status}`);
    if (!location?.includes('accounts.spotify.com')) throw new Error('Not redirecting to Spotify');
  });

  await test('Spotify token endpoint validates user_id', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/spotify/token?user_id=`);
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  await test('Spotify refresh-by-user validates input', async () => {
    const { status } = await fetchJson(`${BACKEND_URL}/auth/spotify/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // Missing user_id
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  await test('Spotify refresh-by-user handles non-existent user', async () => {
    const { status } = await fetchJson(`${BACKEND_URL}/auth/spotify/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'non-existent-user-id' })
    });
    if (status !== 404 && status !== 503) throw new Error(`Expected 404 or 503, got ${status}`);
  });

  // ===== DISCORD =====
  console.log('\n--- Discord OAuth ---');

  await test('Discord OAuth URL generates correctly', async () => {
    const { status, location } = await checkRedirect(
      `${BACKEND_URL}/auth/discord?user_id=test-user&user_email=test@example.com`
    );
    if (status !== 302) throw new Error(`Expected 302 redirect, got ${status}`);
    if (!location?.includes('discord.com')) throw new Error('Not redirecting to Discord');
  });

  await test('Discord refresh-by-user validates input', async () => {
    const { status } = await fetchJson(`${BACKEND_URL}/auth/discord/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  // ===== YOUTUBE =====
  console.log('\n--- YouTube OAuth ---');

  await test('YouTube OAuth URL generates correctly', async () => {
    const { status, location } = await checkRedirect(
      `${BACKEND_URL}/auth/youtube?user_id=test-user&user_email=test@example.com`
    );
    if (status !== 302) throw new Error(`Expected 302 redirect, got ${status}`);
    if (!location?.includes('accounts.google.com')) throw new Error('Not redirecting to Google');
  });

  await test('YouTube refresh-by-user validates input', async () => {
    const { status } = await fetchJson(`${BACKEND_URL}/auth/youtube/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  // ===== LAST.FM =====
  console.log('\n--- Last.fm OAuth ---');

  await test('Last.fm OAuth URL generates correctly', async () => {
    const { status, location } = await checkRedirect(
      `${BACKEND_URL}/auth/lastfm?user_id=test-user`
    );
    // Last.fm may return 302 or 503 if not configured
    if (status !== 302 && status !== 503) throw new Error(`Expected 302 or 503, got ${status}`);
  });

  // ===== DISCONNECT =====
  console.log('\n--- Disconnect Endpoints ---');

  await test('Disconnect validates user_id', async () => {
    const { status } = await fetchJson(`${BACKEND_URL}/auth/disconnect/spotify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  await test('Disconnect handles non-existent integration gracefully', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/disconnect/spotify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'non-existent-user' })
    });
    // Should return success even if nothing to disconnect
    if (status !== 200 && status !== 404 && status !== 503) {
      throw new Error(`Expected 200, 404 or 503, got ${status}`);
    }
  });

  // ===== VERIFY INTEGRATION =====
  console.log('\n--- Verify Integration ---');

  await test('Verify integration validates required fields', async () => {
    const { status } = await fetchJson(`${BACKEND_URL}/auth/verify-integration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'spotify' }) // Missing user_id, code
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  await test('Verify integration handles invalid code', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/verify-integration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_id: 'test-user', 
        provider: 'spotify', 
        code: 'invalid-code'
      })
    });
    if (status !== 404 && status !== 400 && status !== 503) {
      throw new Error(`Expected 404, 400 or 503, got ${status}`);
    }
  });

  // ===== SUMMARY =====
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Test Summary');
  console.log('═'.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   • ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All OAuth integration tests passed!');
    process.exit(0);
  }
}

runTests().catch(console.error);
