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
  return `${role}${SUFFIX}@step2.test`;
}

// ─── SETUP ────────────────────────────────────────────────────

interface Setup {
  userToken:  string;
  userId:     string;
  adminToken: string;
  adminId:    string;
}

async function setup(): Promise<Setup> {
  console.log('\n=== SETUP ===');

  for (const role of ['user', 'admin']) {
    const r = await api('POST', '/api/auth/register', {
      body: { email: email(role), password: 'TestPass123!', name: `Step2 ${role}` },
    });
    if (r.status !== 201) throw new Error(`Register ${role} failed: ${JSON.stringify(r.body)}`);
  }

  await prisma.profile.update({ where: { email: email('admin') }, data: { role: 'ADMIN' } });

  const loginUser  = await api('POST', '/api/auth/login', { body: { email: email('user'),  password: 'TestPass123!' } });
  const loginAdmin = await api('POST', '/api/auth/login', { body: { email: email('admin'), password: 'TestPass123!' } });

  const userToken  = (loginUser.body  as { data: { token: string } }).data.token;
  const adminToken = (loginAdmin.body as { data: { token: string } }).data.token;

  const userProfile  = await prisma.profile.findUnique({ where: { email: email('user')  }, select: { id: true } });
  const adminProfile = await prisma.profile.findUnique({ where: { email: email('admin') }, select: { id: true } });
  if (!userProfile || !adminProfile) throw new Error('Profile lookup failed');

  console.log('  ✓ 2 users created (user, admin)');
  return { userToken, userId: userProfile.id, adminToken, adminId: adminProfile.id };
}

// Today + date helpers
const TODAY = new Date();
const YYYY  = TODAY.getUTCFullYear();
const MM    = String(TODAY.getUTCMonth() + 1).padStart(2, '0');
const DD    = String(TODAY.getUTCDate()).padStart(2, '0');
const todayStr = `${YYYY}-${MM}-${DD}`;

function daysAgo(n: number): string {
  const d = new Date(Date.UTC(YYYY, TODAY.getUTCMonth(), TODAY.getUTCDate() - n));
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date(Date.UTC(YYYY, TODAY.getUTCMonth(), TODAY.getUTCDate() + n));
  return d.toISOString().slice(0, 10);
}

// ─── GROUP V: Validation ──────────────────────────────────────

async function testValidation(s: Setup): Promise<void> {
  console.log('\n=== GROUP V: Validation ===');

  // V1: missing startDate
  const v1 = await api('GET', `/api/analytics/completion?endDate=${todayStr}`, { token: s.userToken });
  check('V1 missing startDate → 400', v1.status === 400);

  // V2: missing endDate
  const v2 = await api('GET', `/api/analytics/completion?startDate=${todayStr}`, { token: s.userToken });
  check('V2 missing endDate → 400', v2.status === 400);

  // V3: bad format
  const v3 = await api('GET', `/api/analytics/completion?startDate=01-01-2026&endDate=${todayStr}`, { token: s.userToken });
  check('V3 bad format → 400', v3.status === 400);

  // V4: startDate > endDate
  const v4 = await api('GET', `/api/analytics/completion?startDate=${todayStr}&endDate=${daysAgo(5)}`, { token: s.userToken });
  check('V4 startDate > endDate → 400', v4.status === 400);

  // V5: endDate in future
  const v5 = await api('GET', `/api/analytics/completion?startDate=${todayStr}&endDate=${daysFromNow(1)}`, { token: s.userToken });
  check('V5 future endDate → 400', v5.status === 400);

  // V6: range > 365 days
  const v6 = await api('GET', `/api/analytics/completion?startDate=${daysAgo(366)}&endDate=${todayStr}`, { token: s.userToken });
  check('V6 range > 365 days → 400', v6.status === 400);

  // V7: valid range is accepted
  const v7 = await api('GET', `/api/analytics/completion?startDate=${daysAgo(30)}&endDate=${todayStr}`, { token: s.userToken });
  check('V7 valid range → 200', v7.status === 200);
}

// ─── GROUP A: Auth ────────────────────────────────────────────

async function testAuth(s: Setup): Promise<void> {
  console.log('\n=== GROUP A: Authorization ===');
  const range = `startDate=${daysAgo(30)}&endDate=${todayStr}`;

  const a1 = await api('GET', `/api/analytics/completion?${range}`);
  check('A1 unauthenticated /analytics/completion → 401', a1.status === 401);

  const a2 = await api('GET', `/api/admin/analytics/completion?${range}`);
  check('A2 unauthenticated /admin/analytics/completion → 401', a2.status === 401);

  const a3 = await api('GET', `/api/admin/analytics/completion?${range}`, { token: s.userToken });
  check('A3 non-admin /admin/analytics/completion → 403', a3.status === 403);

  const a4 = await api('GET', `/api/analytics/completion?${range}`, { token: s.adminToken });
  check('A4 admin can access user endpoint → 200', a4.status === 200);

  const a5 = await api('GET', `/api/admin/analytics/completion?${range}`, { token: s.adminToken });
  check('A5 admin /admin/analytics/completion → 200', a5.status === 200);
}

// ─── GROUP M: Metrics correctness ────────────────────────────

async function testMetrics(s: Setup): Promise<void> {
  console.log('\n=== GROUP M: Metrics correctness ===');

  // Use explicit timestamps to avoid DB clock vs JS clock drift
  const completedAt = new Date();
  const createdJustBefore = new Date(completedAt.getTime() - 60_000); // 1 min before completedAt
  const twoDaysAgo        = new Date(completedAt.getTime() - 2 * 24 * 60 * 60 * 1000);

  await prisma.task.createMany({
    data: [
      // 2 todo (created today, not completed)
      { profileId: s.userId, title: 'M todo 1', status: 'todo', priority: 'medium', description: '', createdAt: createdJustBefore },
      { profileId: s.userId, title: 'M todo 2', status: 'todo', priority: 'medium', description: '', createdAt: createdJustBefore },
      // 2 done (created just before completedAt, completed now)
      { profileId: s.userId, title: 'M done 1', status: 'done', priority: 'medium', description: '', createdAt: createdJustBefore, completedAt },
      { profileId: s.userId, title: 'M done 2', status: 'done', priority: 'medium', description: '', createdAt: createdJustBefore, completedAt },
    ],
  });

  // 1 task created 2 days ago but completed today (avg time ≈ 2 days)
  await prisma.task.create({
    data: {
      profileId:   s.userId,
      title:       'M old completed',
      status:      'done',
      priority:    'medium',
      description: '',
      createdAt:   twoDaysAgo,
      completedAt,
    },
  });

  const r = await api('GET', `/api/analytics/completion?startDate=${daysAgo(7)}&endDate=${todayStr}`, { token: s.userToken });
  check('M1 status 200', r.status === 200);

  const data = (r.body as { data: JsonBody }).data;
  check('M2 timezone=UTC', data['timezone'] === 'UTC');
  check('M3 period.startDate present', typeof (data['period'] as JsonBody)['startDate'] === 'string');
  check('M4 period.endDate present',   typeof (data['period'] as JsonBody)['endDate']   === 'string');

  const tasks = data['tasks'] as JsonBody;
  // 4 tasks created today (within 7-day range); old task created 2 days ago also in range
  check('M5 created = 5', tasks['created'] === 5);
  // 3 tasks completed today (2 done seeded + 1 old completed)
  check('M6 completed = 3', tasks['completed'] === 3);
  // completionRate = 3/5 = 0.6
  check('M7 completionRate = 0.6', tasks['completionRate'] === 0.6);
  // averageCompletionTimeMs > 0
  check('M8 averageCompletionTimeMs > 0', typeof tasks['averageCompletionTimeMs'] === 'number' && (tasks['averageCompletionTimeMs'] as number) > 0);
}

// ─── GROUP E: Edge cases ──────────────────────────────────────

async function testEdgeCases(s: Setup): Promise<void> {
  console.log('\n=== GROUP E: Edge cases ===');

  // E1: empty range (no tasks) → completionRate=0, averageCompletionTimeMs=null
  // Use an account with 0 tasks (admin user has none)
  const e1 = await api('GET', `/api/analytics/completion?startDate=${daysAgo(365)}&endDate=${daysAgo(200)}`, { token: s.adminToken });
  check('E1 status 200 for empty range', e1.status === 200);

  const e1tasks = ((e1.body as { data: JsonBody }).data['tasks'] as JsonBody);
  check('E2 empty range: completionRate=0',                    e1tasks['completionRate']          === 0);
  check('E3 empty range: averageCompletionTimeMs=null',        e1tasks['averageCompletionTimeMs'] === null);

  // E4: today as both startDate and endDate → valid
  const e4 = await api('GET', `/api/analytics/completion?startDate=${todayStr}&endDate=${todayStr}`, { token: s.userToken });
  check('E4 same-day range → 200', e4.status === 200);

  // E5: exactly 365-day range → valid
  const e5 = await api('GET', `/api/analytics/completion?startDate=${daysAgo(365)}&endDate=${todayStr}`, { token: s.userToken });
  check('E5 exactly 365-day range → 200', e5.status === 200);
}

// ─── GROUP S: Shape ───────────────────────────────────────────

async function testShape(s: Setup): Promise<void> {
  console.log('\n=== GROUP S: Response shape ===');

  // User endpoint shape
  const ru = await api('GET', `/api/analytics/completion?startDate=${daysAgo(30)}&endDate=${todayStr}`, { token: s.userToken });
  const du = (ru.body as { data: JsonBody }).data;
  const tu = du['tasks'] as JsonBody;
  check('S1 user: success=true',                      ru.body['success'] === true);
  check('S2 user: timezone=UTC',                      du['timezone'] === 'UTC');
  check('S3 user: tasks.created is number',           typeof tu['created']                 === 'number');
  check('S4 user: tasks.completed is number',         typeof tu['completed']               === 'number');
  check('S5 user: tasks.completionRate is number',    typeof tu['completionRate']           === 'number');
  check('S6 user: averageCompletionTimeMs type ok',
    tu['averageCompletionTimeMs'] === null || typeof tu['averageCompletionTimeMs'] === 'number');
  check('S7 user: NO byStatus field (user endpoint)', !('byStatus' in tu));

  // Admin endpoint shape
  const ra = await api('GET', `/api/admin/analytics/completion?startDate=${daysAgo(30)}&endDate=${todayStr}`, { token: s.adminToken });
  const da = (ra.body as { data: JsonBody }).data;
  const ta = da['tasks'] as JsonBody;
  check('S8  admin: success=true',                    ra.body['success'] === true);
  check('S9  admin: byStatus is object',              typeof ta['byStatus'] === 'object' && ta['byStatus'] !== null);
  const bs = ta['byStatus'] as JsonBody;
  check('S10 admin: byStatus.todo is number',         typeof bs['todo']  === 'number');
  check('S11 admin: byStatus.doing is number',        typeof bs['doing'] === 'number');
  check('S12 admin: byStatus.done is number',         typeof bs['done']  === 'number');
  check('S13 admin: todo+doing+done <= created',
    (bs['todo'] as number) + (bs['doing'] as number) + (bs['done'] as number) <= (ta['created'] as number));
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
  console.log('  STEP 2 — Task Completion Analytics');
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
    console.log('  ✅  ALL TESTS PASSED — STEP 2 verified');
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
