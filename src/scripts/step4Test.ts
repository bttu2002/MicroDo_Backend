import prisma from '../config/prisma';

const BASE_URL = 'http://localhost:3000';
const SUFFIX   = Date.now().toString().slice(-6);

type JsonBody = Record<string, unknown>;

async function api(
  method: string,
  endpoint: string,
  opts?: { body?: JsonBody; token?: string }
): Promise<{ status: number; body: JsonBody }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token !== undefined) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(opts?.body !== undefined && { body: JSON.stringify(opts.body) }),
  });
  let body: JsonBody;
  try {
    body = await res.json() as JsonBody;
  } catch {
    body = { _raw: 'non-json response' };
  }
  return { status: res.status, body };
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function email(role: string): string {
  return `${role}${SUFFIX}@step4.test`;
}

// Today helpers (UTC)
const TODAY = new Date();
const YYYY  = TODAY.getUTCFullYear();
const MON   = TODAY.getUTCMonth();
const DAY   = TODAY.getUTCDate();
const todayStr = `${YYYY}-${String(MON + 1).padStart(2, '0')}-${String(DAY).padStart(2, '0')}`;

function daysAgo(n: number): string {
  const d = new Date(Date.UTC(YYYY, MON, DAY - n));
  return d.toISOString().slice(0, 10);
}

function utcAt(daysOffset: number, hour: number): Date {
  return new Date(Date.UTC(YYYY, MON, DAY + daysOffset, hour, 0, 0, 0));
}

// ─── SETUP ────────────────────────────────────────────────────

interface Setup {
  userToken:  string;
  userId:     string;
  adminToken: string;
}

async function setup(): Promise<Setup> {
  console.log('\n=== SETUP ===');

  for (const role of ['user', 'admin']) {
    const r = await api('POST', '/api/auth/register', {
      body: { email: email(role), password: 'TestPass123!', name: `Step4 ${role}` },
    });
    if (r.status !== 201) throw new Error(`Register ${role} failed: ${JSON.stringify(r.body)}`);
  }

  await prisma.profile.update({ where: { email: email('admin') }, data: { role: 'ADMIN' } });

  const [loginUser, loginAdmin] = await Promise.all([
    api('POST', '/api/auth/login', { body: { email: email('user'),  password: 'TestPass123!' } }),
    api('POST', '/api/auth/login', { body: { email: email('admin'), password: 'TestPass123!' } }),
  ]);

  const userToken  = (loginUser.body  as { data: { token: string } }).data.token;
  const adminToken = (loginAdmin.body as { data: { token: string } }).data.token;

  const userProfile = await prisma.profile.findUnique({ where: { email: email('user') }, select: { id: true } });
  if (!userProfile) throw new Error('Profile lookup failed');

  console.log('  ✓ 2 users created (user, admin)');
  return { userToken, userId: userProfile.id, adminToken };
}

// ─── GROUP V: Validation ──────────────────────────────────────

async function testValidation(s: Setup): Promise<void> {
  console.log('\n=== GROUP V: Validation ===');

  const v1 = await api('GET', `/api/analytics/trends?endDate=${todayStr}`, { token: s.userToken });
  check('V1 missing startDate → 400', v1.status === 400);

  const v2 = await api('GET', `/api/analytics/trends?startDate=${todayStr}`, { token: s.userToken });
  check('V2 missing endDate → 400', v2.status === 400);

  const v3 = await api('GET', `/api/analytics/trends?startDate=01-01-2026&endDate=${todayStr}`, { token: s.userToken });
  check('V3 bad date format → 400', v3.status === 400);

  const v4 = await api('GET', `/api/analytics/trends?startDate=${daysAgo(366)}&endDate=${todayStr}`, { token: s.userToken });
  check('V4 range > 365 days → 400', v4.status === 400);
}

// ─── GROUP A: Authorization ───────────────────────────────────

async function testAuth(s: Setup): Promise<void> {
  console.log('\n=== GROUP A: Authorization ===');
  const range = `startDate=${daysAgo(7)}&endDate=${todayStr}`;

  const a1 = await api('GET', `/api/analytics/trends?${range}`);
  check('A1 unauthenticated /analytics/trends → 401', a1.status === 401);

  const a2 = await api('GET', `/api/admin/analytics/trends?${range}`);
  check('A2 unauthenticated /admin/analytics/trends → 401', a2.status === 401);

  const a3 = await api('GET', `/api/admin/analytics/trends?${range}`, { token: s.userToken });
  check('A3 non-admin /admin/analytics/trends → 403', a3.status === 403);

  const a4 = await api('GET', `/api/analytics/trends?${range}`, { token: s.adminToken });
  check('A4 admin can access user trends → 200', a4.status === 200);

  const a5 = await api('GET', `/api/admin/analytics/trends?${range}`, { token: s.adminToken });
  check('A5 admin /admin/analytics/trends → 200', a5.status === 200);
}

// ─── GROUP M: Metrics correctness ────────────────────────────

async function testMetrics(s: Setup): Promise<void> {
  console.log('\n=== GROUP M: Metrics correctness ===');

  // Seed tasks on two specific days (2 and 1 days ago)
  // Day A (2 days ago): 3 created, 2 completed
  // Day B (1 day ago):  1 created, 1 completed
  await prisma.task.createMany({
    data: [
      // Day A — created
      { profileId: s.userId, title: 'T4-A1', status: 'todo',  priority: 'medium', description: '', createdAt: utcAt(-2, 8) },
      { profileId: s.userId, title: 'T4-A2', status: 'todo',  priority: 'medium', description: '', createdAt: utcAt(-2, 9) },
      { profileId: s.userId, title: 'T4-A3', status: 'done',  priority: 'medium', description: '', createdAt: utcAt(-2, 10), completedAt: utcAt(-2, 14) },
      // Day A — one more done (completed same day)
      { profileId: s.userId, title: 'T4-A4', status: 'done',  priority: 'medium', description: '', createdAt: utcAt(-2, 11), completedAt: utcAt(-2, 15) },
      // Day B — created + completed
      { profileId: s.userId, title: 'T4-B1', status: 'done',  priority: 'medium', description: '', createdAt: utcAt(-1, 8),  completedAt: utcAt(-1, 12) },
    ],
  });

  const r = await api('GET', `/api/analytics/trends?startDate=${daysAgo(3)}&endDate=${todayStr}`, { token: s.userToken });
  check('M1 status 200', r.status === 200);

  const data   = (r.body as { data: JsonBody }).data;
  const series = data['series'] as JsonBody[];

  // Range is 4 days (3 days ago → today), so series length = 4
  check('M2 series length = 4 (zero-fill all days in range)', series.length === 4);

  // Each point has date/created/completed
  const allHaveFields = series.every(p =>
    typeof p['date'] === 'string' &&
    typeof p['created'] === 'number' &&
    typeof p['completed'] === 'number'
  );
  check('M3 all series points have date/created/completed', allHaveFields);

  // Day 0 (3 days ago) → 0 created, 0 completed
  const dayZero = series[0];
  check('M4 day 3-days-ago: created=0 completed=0',
    dayZero !== undefined && dayZero['created'] === 0 && dayZero['completed'] === 0);

  // Day 1 (2 days ago) → 4 created, 2 completed
  const dayA = series[1];
  check('M5 day 2-days-ago: created=4', dayA !== undefined && dayA['created'] === 4);
  check('M6 day 2-days-ago: completed=2', dayA !== undefined && dayA['completed'] === 2);

  // Day 2 (1 day ago) → 1 created, 1 completed
  const dayB = series[2];
  check('M7 day 1-day-ago: created=1', dayB !== undefined && dayB['created'] === 1);
  check('M8 day 1-day-ago: completed=1', dayB !== undefined && dayB['completed'] === 1);

  // Today → 0 created, 0 completed (no tasks seeded today)
  const dayToday = series[3];
  check('M9 today: created=0 completed=0',
    dayToday !== undefined && dayToday['created'] === 0 && dayToday['completed'] === 0);

  // Dates are in ascending order
  check('M10 series dates are ascending',
    series.every((p, i) => i === 0 || String((series[i - 1] as JsonBody)['date']) < String(p['date'])));
}

// ─── GROUP E: Edge cases ──────────────────────────────────────

async function testEdgeCases(s: Setup): Promise<void> {
  console.log('\n=== GROUP E: Edge cases ===');

  // E1: single-day range → series length = 1
  const e1 = await api('GET', `/api/analytics/trends?startDate=${todayStr}&endDate=${todayStr}`, { token: s.userToken });
  check('E1 single-day range → 200', e1.status === 200);
  const e1series = ((e1.body as { data: JsonBody }).data['series'] as JsonBody[]);
  check('E2 single-day range: series length = 1', e1series.length === 1);

  // E3: admin with no tasks in range → all zeros, no throw
  const e3 = await api('GET', `/api/admin/analytics/trends?startDate=${daysAgo(365)}&endDate=${daysAgo(300)}`, { token: s.adminToken });
  check('E3 empty range → 200', e3.status === 200);
  const e3series = ((e3.body as { data: JsonBody }).data['series'] as JsonBody[]);
  const allZero = e3series.every(p => p['created'] === 0 && p['completed'] === 0);
  check('E4 empty range: all series points are zero', allZero);
}

// ─── GROUP S: Response shape ──────────────────────────────────

async function testShape(s: Setup): Promise<void> {
  console.log('\n=== GROUP S: Response shape ===');

  const ru = await api('GET', `/api/analytics/trends?startDate=${daysAgo(7)}&endDate=${todayStr}`, { token: s.userToken });
  const du = (ru.body as { data: JsonBody }).data;
  check('S1 user trends: success=true',           ru.body['success'] === true);
  check('S2 user trends: timezone=UTC',            du['timezone']    === 'UTC');
  check('S3 user trends: period.startDate string', typeof (du['period'] as JsonBody)['startDate'] === 'string');
  check('S4 user trends: period.endDate string',   typeof (du['period'] as JsonBody)['endDate']   === 'string');
  check('S5 user trends: series is array',         Array.isArray(du['series']));
  // 8-day range (7 days ago → today) → 8 points
  check('S6 user trends: series length = 8',       (du['series'] as JsonBody[]).length === 8);

  // Spot-check first series point shape
  const pt = (du['series'] as JsonBody[])[0];
  check('S7 series point: date is YYYY-MM-DD string',
    pt !== undefined && typeof pt['date'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pt['date'] as string));

  const ra = await api('GET', `/api/admin/analytics/trends?startDate=${daysAgo(7)}&endDate=${todayStr}`, { token: s.adminToken });
  const da = (ra.body as { data: JsonBody }).data;
  check('S8 admin trends: success=true', ra.body['success'] === true);
  check('S9 admin trends: series is array', Array.isArray(da['series']));
}

// ─── CLEANUP ──────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log('\n=== CLEANUP ===');
  for (const role of ['user', 'admin']) {
    await prisma.profile.deleteMany({ where: { email: email(role) } });
  }
  console.log('  Cleanup complete');
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('==========================================');
  console.log('  STEP 4 — Task Trend Analytics');
  console.log('==========================================');

  let s: Setup | null = null;

  try {
    s = await setup();
    await testValidation(s);
    await testAuth(s);
    await testMetrics(s);
    await testEdgeCases(s);
    await testShape(s);
  } catch (err) {
    console.error('Unexpected error during tests:', err);
    failed++;
  } finally {
    await cleanup();
  }

  console.log('\n==========================================');
  console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
  if (failed === 0) {
    console.log('  ✅  ALL TESTS PASSED — STEP 4 verified');
  } else {
    console.log('  ❌  SOME TESTS FAILED');
  }
  console.log('==========================================\n');

  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

void main().catch((err: unknown) => {
  console.error('Fatal:', err);
  void prisma.$disconnect();
  process.exit(1);
});
