/**
 * STEP 6 — Workload Heatmap Integration Test
 * Run: EMAIL=x PASSWORD=y ADMIN_TOKEN=z npx ts-node --transpile-only step6Test.ts
 */

const BASE_URL    = process.env.BASE_URL    ?? 'http://localhost:3000';
const EMAIL       = process.env.EMAIL       ?? '';
const PASSWORD    = process.env.PASSWORD    ?? '';
let   TOKEN       = process.env.TOKEN       ?? '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

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
    const http = require('http') as typeof import('http');
    const url  = new URL(path, BASE_URL);
    const r = http.request(
      { hostname: url.hostname, port: Number(url.port) || 80, path: url.pathname + url.search, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c: Buffer) => { raw += c.toString(); });
        res.on('end', () => {
          try   { resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
        });
      },
    );
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
  console.log('\n────────────────────────────────────────');
  console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

// ─── Heatmap shape assertions ─────────────────────────────────

interface Bucket { dayOfWeek: number; hour: number; created: number; completed: number; total: number }
interface Summary { peakDayOfWeek: number | null; peakHour: number | null; totalCreated: number; totalCompleted: number }

function assertHeatmapShape(heatmap: unknown[], summary: unknown, label: string): void {
  // Exactly 168 entries
  assert(`${label}: exactly 168 entries`, heatmap.length === 168, heatmap.length);

  // Stable ordering: first = 0:0, last = 6:23
  const first = heatmap[0] as Bucket;
  const last  = heatmap[167] as Bucket;
  assert(`${label}: first entry is dayOfWeek=0 hour=0`, first?.dayOfWeek === 0 && first?.hour === 0);
  assert(`${label}: last entry is dayOfWeek=6 hour=23`, last?.dayOfWeek === 6 && last?.hour === 23);

  // Ordering invariant: dayOfWeek ASC → hour ASC
  let orderOk = true;
  for (let i = 1; i < heatmap.length; i++) {
    const prev = heatmap[i - 1] as Bucket;
    const curr = heatmap[i]     as Bucket;
    if (curr.dayOfWeek < prev.dayOfWeek || (curr.dayOfWeek === prev.dayOfWeek && curr.hour <= prev.hour && i % 24 !== 0)) {
      orderOk = false; break;
    }
  }
  assert(`${label}: ordering stable dayOfWeek ASC → hour ASC`, orderOk);

  // total = created + completed for every bucket
  const invariantOk = heatmap.every((b) => {
    const bkt = b as Bucket;
    return bkt.total === bkt.created + bkt.completed;
  });
  assert(`${label}: total = created + completed invariant`, invariantOk);

  // summary cross-check: sum of all totals = totalCreated + totalCompleted
  const sumCreated   = heatmap.reduce((s, b) => s + (b as Bucket).created,   0);
  const sumCompleted = heatmap.reduce((s, b) => s + (b as Bucket).completed, 0);
  const s = summary as Summary;
  assert(`${label}: summary totalCreated matches sum`, s?.totalCreated   === sumCreated,   `${s?.totalCreated} vs ${sumCreated}`);
  assert(`${label}: summary totalCompleted matches sum`, s?.totalCompleted === sumCompleted, `${s?.totalCompleted} vs ${sumCompleted}`);
}

// ─── Main ─────────────────────────────────────────────────────

async function run(): Promise<void> {
  if (!TOKEN) {
    if (!EMAIL || !PASSWORD) { console.error('Set TOKEN or EMAIL+PASSWORD'); process.exit(1); }
    console.log(`[Auth] Logging in as ${EMAIL}…`);
    const loginRes = await req('POST', '/api/auth/login', '', { email: EMAIL, password: PASSWORD });
    const token = (loginRes.data as { data?: { token?: string } }).data?.token;
    if (!token) { console.error('Login failed:', loginRes.status, loginRes.data); process.exit(1); }
    TOKEN = token;
    console.log('[Auth] Login OK');
  }

  const today     = new Date().toISOString().slice(0, 10);
  const emptyDate = '2020-01-01'; // far past — guaranteed no data

  // ── Create a completed task (to seed one heatmap bucket) ────
  console.log('\n[Setup] Creating and completing a test task…');
  const taskRes = await req('POST', '/api/tasks', TOKEN, { title: 'Step6 heatmap test task' });
  const taskId  = (taskRes.data as { data?: { _id?: string } }).data?._id;
  assert('Create test task', typeof taskId === 'string', taskRes.status);
  if (typeof taskId !== 'string') { printResult(); return; }

  // Complete the task by setting status to done
  await req('PUT', `/api/tasks/${taskId}`, TOKEN, { status: 'done' });

  // ── 1. GET /api/analytics/heatmap — basic shape ──────────────
  console.log(`\n[GET /api/analytics/heatmap?startDate=${today}&endDate=${today}]`);
  const heatmapRes  = await req('GET', `/api/analytics/heatmap?startDate=${today}&endDate=${today}`, TOKEN);
  assert('200 status', heatmapRes.status === 200, heatmapRes.status);
  const heatmapData = (heatmapRes.data as { data?: JsonBody }).data as JsonBody;
  const heatmap     = heatmapData?.heatmap as Bucket[] | undefined;
  const summary     = heatmapData?.summary as Summary | undefined;
  assert('Has heatmap array', Array.isArray(heatmap));
  assert('Has summary object', typeof summary === 'object' && summary !== null);
  assert('Has period object', typeof heatmapData?.period === 'object');
  assert('timezone = UTC', heatmapData?.timezone === 'UTC');

  if (Array.isArray(heatmap)) {
    assertHeatmapShape(heatmap, summary, 'user heatmap');

    // At least one bucket has created > 0 (task created today)
    const hasCreated = heatmap.some((b) => b.created > 0);
    assert('At least one created bucket > 0', hasCreated);

    // At least one bucket has completed > 0 (task completed today)
    const hasCompleted = heatmap.some((b) => b.completed > 0);
    assert('At least one completed bucket > 0', hasCompleted);

    // Peak is not null when data exists
    assert('peakDayOfWeek is number when data exists', typeof summary?.peakDayOfWeek === 'number');
    assert('peakHour is number when data exists', typeof summary?.peakHour === 'number');
    assert('peakDayOfWeek in 0..6', (summary?.peakDayOfWeek ?? -1) >= 0 && (summary?.peakDayOfWeek ?? 7) <= 6);
    assert('peakHour in 0..23', (summary?.peakHour ?? -1) >= 0 && (summary?.peakHour ?? 24) <= 23);
  }

  // ── 2. Empty date range → peak null ──────────────────────────
  console.log(`\n[GET /api/analytics/heatmap — empty range ${emptyDate}]`);
  const emptyRes  = await req('GET', `/api/analytics/heatmap?startDate=${emptyDate}&endDate=${emptyDate}`, TOKEN);
  assert('200 status (empty)', emptyRes.status === 200, emptyRes.status);
  const emptyData = (emptyRes.data as { data?: JsonBody }).data as JsonBody;
  const emptyHeatmap = emptyData?.heatmap as unknown[] | undefined;
  const emptySummary = emptyData?.summary as Summary | undefined;
  assert('Empty: 168 entries', Array.isArray(emptyHeatmap) && emptyHeatmap.length === 168, emptyHeatmap?.length);
  assert('Empty: all totals = 0', Array.isArray(emptyHeatmap) && emptyHeatmap.every((b) => (b as Bucket).total === 0));
  assert('Empty: peakDayOfWeek is null', emptySummary?.peakDayOfWeek === null, emptySummary?.peakDayOfWeek);
  assert('Empty: peakHour is null', emptySummary?.peakHour === null, emptySummary?.peakHour);
  assert('Empty: totalCreated = 0', emptySummary?.totalCreated === 0);
  assert('Empty: totalCompleted = 0', emptySummary?.totalCompleted === 0);

  // ── 3. completedAt NULL not counted ──────────────────────────
  // Create a todo task — it has no completedAt → should NOT appear in completed buckets
  console.log('\n[completedAt NULL safety test]');
  const todoRes  = await req('POST', '/api/tasks', TOKEN, { title: 'Step6 todo task no completedAt' });
  const todoId   = (todoRes.data as { data?: { _id?: string } }).data?._id;
  const todoDate = new Date().toISOString().slice(0, 10);
  const nullCheckRes  = await req('GET', `/api/analytics/heatmap?startDate=${todoDate}&endDate=${todoDate}`, TOKEN);
  const nullCheckData = (nullCheckRes.data as { data?: JsonBody }).data as JsonBody;
  const nullHeatmap   = nullCheckData?.heatmap as Bucket[] | undefined;
  // totalCompleted should NOT increase just because a todo task exists
  // (We check that completed sum <= created sum, since completed tasks are a subset)
  if (Array.isArray(nullHeatmap)) {
    const totalComp = nullHeatmap.reduce((s, b) => s + b.completed, 0);
    const totalCrea = nullHeatmap.reduce((s, b) => s + b.created,   0);
    assert('completedAt NULL not counted: completed <= created', totalComp <= totalCrea, `completed=${totalComp} created=${totalCrea}`);
  }

  // ── 4. Admin endpoint ─────────────────────────────────────────
  if (ADMIN_TOKEN) {
    console.log(`\n[GET /api/admin/analytics/heatmap?startDate=${today}&endDate=${today}]`);
    const adminRes  = await req('GET', `/api/admin/analytics/heatmap?startDate=${today}&endDate=${today}`, ADMIN_TOKEN);
    assert('200 status (admin)', adminRes.status === 200, adminRes.status);
    const adminData    = (adminRes.data as { data?: JsonBody }).data as JsonBody;
    const adminHeatmap = adminData?.heatmap as unknown[] | undefined;
    const adminSummary = adminData?.summary;
    assert('Admin: has heatmap array', Array.isArray(adminHeatmap));
    if (Array.isArray(adminHeatmap)) {
      assertHeatmapShape(adminHeatmap, adminSummary, 'admin heatmap');
    }
    assert('Admin: timezone = UTC', adminData?.timezone === 'UTC');
  } else {
    console.log('\n[Skipping admin heatmap — ADMIN_TOKEN not set]');
  }

  // ── 5. Date validation: future date → 400 ─────────────────────
  console.log('\n[Validation: future endDate]');
  const futureRes = await req('GET', '/api/analytics/heatmap?startDate=2099-01-01&endDate=2099-12-31', TOKEN);
  assert('400 for future date', futureRes.status === 400, futureRes.status);

  // ── 6. Date validation: range > 365 days → 400 ───────────────
  console.log('\n[Validation: range > 365 days]');
  const wideRes = await req('GET', '/api/analytics/heatmap?startDate=2024-01-01&endDate=2025-12-31', TOKEN);
  assert('400 for > 365 day range', wideRes.status === 400, wideRes.status);

  // ── 7. Auth required ──────────────────────────────────────────
  console.log('\n[Auth: no token → 401]');
  const noAuthRes = await req('GET', `/api/analytics/heatmap?startDate=${today}&endDate=${today}`, '');
  assert('401 without token', noAuthRes.status === 401, noAuthRes.status);

  // Cleanup
  if (typeof todoId === 'string') await req('DELETE', `/api/tasks/${todoId}`, TOKEN);
  await req('DELETE', `/api/tasks/${taskId}`, TOKEN);
  console.log('\n[Cleanup] Test tasks deleted');

  printResult();
}

run().catch((err) => { console.error(err); process.exit(1); });
