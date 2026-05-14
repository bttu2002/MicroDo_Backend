/**
 * STEP 5 — Time Tracking Integration Test
 * Run: EMAIL=user@test.com PASSWORD=pass npx ts-node --transpile-only step5Test.ts
 * Or:  TOKEN=xxx npx ts-node --transpile-only step5Test.ts
 */

const BASE_URL    = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL       = process.env.EMAIL    ?? '';
const PASSWORD    = process.env.PASSWORD ?? '';
let   TOKEN       = process.env.TOKEN    ?? '';
let   ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

// ─── HTTP helper ─────────────────────────────────────────────

type JsonBody = Record<string, unknown>;

async function req(
  method: string,
  path: string,
  token: string,
  body?: JsonBody,
): Promise<{ status: number; data: unknown }> {
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (payload !== undefined) headers['Content-Length'] = String(Buffer.byteLength(payload));

  return new Promise((resolve, reject) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const http = require('http') as typeof import('http');
    const url  = new URL(path, BASE_URL);
    const opts = {
      hostname: url.hostname,
      port:     Number(url.port) || 80,
      path:     url.pathname + url.search,
      method,
      headers,
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c: Buffer) => { raw += c.toString(); });
      res.on('end', () => {
        try   { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
      });
    });
    r.on('error', reject);
    if (payload !== undefined) r.write(payload);
    r.end();
  });
}

// ─── Assertion helpers ────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`, detail ?? '');
    failed++;
  }
}

function printResult(): void {
  console.log('\n────────────────────────────────');
  console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────

async function run(): Promise<void> {
  // Auto-login if no TOKEN provided
  if (!TOKEN) {
    if (!EMAIL || !PASSWORD) {
      console.error('Set TOKEN env var, or EMAIL + PASSWORD to auto-login.');
      process.exit(1);
    }
    console.log(`[Auth] Logging in as ${EMAIL}…`);
    const loginRes = await req('POST', '/api/auth/login', '', { email: EMAIL, password: PASSWORD });
    const token = (loginRes.data as { data?: { token?: string } }).data?.token;
    if (!token) {
      console.error('Login failed:', loginRes.status, loginRes.data);
      process.exit(1);
    }
    TOKEN = token;
    console.log('[Auth] Login OK');
  }

  // Create a task owned by the test user
  console.log('\n[Setup] Creating test task…');
  const taskRes = await req('POST', '/api/tasks', TOKEN, {
    title: 'Step5 time tracking test task',
  });
  const taskId = (taskRes.data as { data?: { _id?: string } }).data?._id;
  assert('Create test task', typeof taskId === 'string', taskRes.status);
  if (typeof taskId !== 'string') { printResult(); return; }

  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Start session ─────────────────────────────────────────
  console.log('\n[POST /api/time-tracking/sessions/start]');
  const startRes = await req('POST', '/api/time-tracking/sessions/start', TOKEN, { taskId });
  assert('201 status', startRes.status === 201, startRes.status);
  const session = (startRes.data as { data?: JsonBody }).data as JsonBody;
  assert('Session has id', typeof session?.id === 'string');
  assert('stoppedAt is null', session?.stoppedAt === null);
  assert('durationSeconds is null', session?.durationSeconds === null);

  // ── 2. Duplicate start → 409 ──────────────────────────────
  console.log('\n[POST /api/time-tracking/sessions/start — duplicate]');
  const dupRes = await req('POST', '/api/time-tracking/sessions/start', TOKEN, { taskId });
  assert('409 CONFLICT', dupRes.status === 409, dupRes.status);

  // ── 3. Get active session ────────────────────────────────────
  console.log('\n[GET /api/time-tracking/sessions/active]');
  const activeRes = await req('GET', '/api/time-tracking/sessions/active', TOKEN);
  assert('200 status', activeRes.status === 200, activeRes.status);
  const activeData = (activeRes.data as { data?: JsonBody }).data;
  assert('Active session returned', activeData !== null);

  // ── 4. Stop session ──────────────────────────────────────────
  console.log('\n[POST /api/time-tracking/sessions/stop]');
  const stopRes = await req('POST', '/api/time-tracking/sessions/stop', TOKEN);
  assert('200 status', stopRes.status === 200, stopRes.status);
  const stopped = (stopRes.data as { data?: JsonBody }).data as JsonBody;
  assert('stoppedAt is set', stopped?.stoppedAt !== null && stopped?.stoppedAt !== undefined);
  assert('durationSeconds is number >= 0', typeof stopped?.durationSeconds === 'number' && (stopped.durationSeconds as number) >= 0);

  // ── 5. Stop again → 404 ──────────────────────────────────────
  console.log('\n[POST /api/time-tracking/sessions/stop — no active]');
  const stopAgainRes = await req('POST', '/api/time-tracking/sessions/stop', TOKEN);
  assert('404 NOT_FOUND', stopAgainRes.status === 404, stopAgainRes.status);

  // ── 6. Get active → null after stop ──────────────────────────
  console.log('\n[GET /api/time-tracking/sessions/active — after stop]');
  const noActiveRes = await req('GET', '/api/time-tracking/sessions/active', TOKEN);
  assert('200 status', noActiveRes.status === 200);
  assert('data is null after stop', (noActiveRes.data as { data?: unknown }).data === null);

  // ── 7. Start on non-owned task → 404 ─────────────────────────
  console.log('\n[POST /api/time-tracking/sessions/start — non-owned task]');
  const fakeRes = await req('POST', '/api/time-tracking/sessions/start', TOKEN, {
    taskId: '00000000-0000-0000-0000-000000000000',
  });
  assert('404 for non-owned task', fakeRes.status === 404, fakeRes.status);

  // ── 8. List sessions ──────────────────────────────────────────
  console.log(`\n[GET /api/time-tracking/sessions?startDate=${today}&endDate=${today}]`);
  const listRes = await req('GET', `/api/time-tracking/sessions?startDate=${today}&endDate=${today}`, TOKEN);
  assert('200 status', listRes.status === 200, listRes.status);
  const listData = (listRes.data as { data?: JsonBody }).data as JsonBody;
  assert('Has sessions array', Array.isArray(listData?.sessions));
  assert('Sessions count >= 1', Array.isArray(listData?.sessions) && (listData.sessions as unknown[]).length >= 1);
  assert('Has total field', typeof listData?.total === 'number');

  // ── 9. Analytics: GET /api/analytics/time ────────────────────
  console.log(`\n[GET /api/analytics/time?startDate=${today}&endDate=${today}]`);
  const analyticsRes = await req('GET', `/api/analytics/time?startDate=${today}&endDate=${today}`, TOKEN);
  assert('200 status', analyticsRes.status === 200, analyticsRes.status);
  const analyticsData = (analyticsRes.data as { data?: JsonBody }).data as JsonBody;
  assert('Has summary', typeof analyticsData?.summary === 'object');
  assert('Has byTask array', Array.isArray(analyticsData?.byTask));
  assert('sessionCount >= 1', (analyticsData?.summary as JsonBody)?.sessionCount >= 1);
  assert('totalDurationSeconds >= 0', (analyticsData?.summary as JsonBody)?.totalDurationSeconds >= 0);

  // ── 10. Admin analytics ───────────────────────────────────────
  if (ADMIN_TOKEN) {
    console.log(`\n[GET /api/admin/analytics/time?startDate=${today}&endDate=${today}]`);
    const adminTimeRes = await req('GET', `/api/admin/analytics/time?startDate=${today}&endDate=${today}`, ADMIN_TOKEN);
    assert('200 status (admin)', adminTimeRes.status === 200, adminTimeRes.status);
    const adminData = (adminTimeRes.data as { data?: JsonBody }).data as JsonBody;
    assert('Admin: has summary', typeof adminData?.summary === 'object');
    assert('Admin: no byTask field', !('byTask' in (adminData ?? {})));
  } else {
    console.log('\n[Skipping admin time analytics — ADMIN_TOKEN not set]');
  }

  // ── 11. Validation: bad taskId → 400 ─────────────────────────
  console.log('\n[POST /api/time-tracking/sessions/start — invalid taskId]');
  const badIdRes = await req('POST', '/api/time-tracking/sessions/start', TOKEN, { taskId: 'not-a-uuid' });
  assert('400 VALIDATION_ERROR', badIdRes.status === 400, badIdRes.status);

  // ── 12. Validation: missing date range → 400 ─────────────────
  console.log('\n[GET /api/time-tracking/sessions — missing query]');
  const noQueryRes = await req('GET', '/api/time-tracking/sessions', TOKEN);
  assert('400 VALIDATION_ERROR', noQueryRes.status === 400, noQueryRes.status);

  // Cleanup: delete test task
  const delRes = await req('DELETE', `/api/tasks/${taskId}`, TOKEN);
  console.log(`\n[Cleanup] Test task deleted (${delRes.status})`);

  printResult();
}

run().catch((err) => { console.error(err); process.exit(1); });
