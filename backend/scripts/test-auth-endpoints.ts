/**
 * Test Script for Auth Endpoints
 * 
 * Tests the new refresh-by-user endpoints and other auth functionality.
 * 
 * Usage: npx tsx backend/scripts/test-auth-endpoints.ts
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://music-companion-production.up.railway.app';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  response?: any;
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
  const data = await response.json();
  return { status: response.status, data };
}

// ==================== TESTS ====================

async function runTests() {
  console.log('\n🧪 Testing Auth Endpoints');
  console.log(`Backend: ${BACKEND_URL}\n`);

  // 1. Health Check
  await test('Health endpoint returns OK', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/health`);
    if (status !== 200) throw new Error(`Status ${status}`);
    if (data.status !== 'ok') throw new Error('Status not ok');
  });

  // 2. Auth Status
  await test('Auth status returns configured services', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/status`);
    if (status !== 200) throw new Error(`Status ${status}`);
    if (!data.success) throw new Error('Response not successful');
    if (!data.data?.spotify) throw new Error('Missing Spotify config');
  });

  // 3. Spotify refresh-by-user (without valid user_id - should return 404)
  await test('Spotify refresh-by-user returns 404 for invalid user', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/spotify/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test-invalid-user-id' }),
    });
    // Should return 404 (no refresh token found) or 503 (DB not configured)
    if (status !== 404 && status !== 503) throw new Error(`Expected 404/503, got ${status}`);
  });

  // 4. Spotify refresh-by-user (without user_id - should return 400)
  await test('Spotify refresh-by-user returns 400 if missing user_id', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/spotify/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
    if (!data.error?.includes('Missing')) throw new Error('Wrong error message');
  });

  // 5. Discord refresh-by-user (without user_id - should return 400)
  await test('Discord refresh-by-user returns 400 if missing user_id', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/discord/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  // 6. YouTube refresh-by-user (without user_id - should return 400)
  await test('YouTube refresh-by-user returns 400 if missing user_id', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/youtube/refresh-by-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  // 7. Disconnect endpoint validation
  await test('Disconnect returns 400 if missing user_id', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/disconnect/spotify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  // 8. Verify-integration endpoint validation
  await test('Verify-integration returns 400 if missing fields', async () => {
    const { status, data } = await fetchJson(`${BACKEND_URL}/auth/verify-integration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'spotify' }), // Missing user_id and code
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  // ==================== SUMMARY ====================
  console.log('\n📊 Test Summary');
  console.log('─'.repeat(40));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

runTests().catch(console.error);
