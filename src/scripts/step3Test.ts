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
  return `${role}${SUFFIX}@step3.test`;
}

// Today helpers
const TODAY = new Date();
const YYYY  = TODAY.getUTCFullYear();
const MM    = String(TODAY.getUTCMonth() + 1).padStart(2, '0');
const DD    = String(TODAY.getUTCDate()).padStart(2, '0');
const todayStr = `${YYYY}-${MM}-${DD}`;

function daysAgo(n: number): string {
  const d = new Date(Date.UTC(YYYY, TODAY.getUTCMonth(), TODAY.getUTCDate() - n));
  return d.toISOString().slice(0, 10);
}

// ─── SETUP ────────────────────────────────────────────────────

interface Setup {
  userToken:        string;
  userId:           string;
  adminToken:       string;
  adminId:          string;
  nonMemberToken:   string;
  deptId:           string;
}

async function setup(): Promise<Setup> {
  console.log('\n=== SETUP ===');

  for (const role of ['user', 'admin', 'nonmember']) {
    const r = await api('POST', '/api/auth/register', {
      body: { email: email(role), password: 'TestPass123!', name: `Step3 ${role}` },
    });
    if (r.status !== 201) throw new Error(`Register ${role} failed: ${JSON.stringify(r.body)}`);
  }

  await prisma.profile.update({ where: { email: email('admin') }, data: { role: 'ADMIN' } });

  const [loginUser, loginAdmin, loginNonMember] = await Promise.all([
    api('POST', '/api/auth/login', { body: { email: email('user'),      password: 'TestPass123!' } }),
    api('POST', '/api/auth/login', { body: { email: email('admin'),     password: 'TestPass123!' } }),
    api('POST', '/api/auth/login', { body: { email: email('nonmember'), password: 'TestPass123!' } }),
  ]);

  const userToken      = (loginUser.body      as { data: { token: string } }).data.token;
  const adminToken     = (loginAdmin.body     as { data: { token: string } }).data.token;
  const nonMemberToken = (loginNonMember.body as { data: { token: string } }).data.token;

  const [userProfile, adminProfile] = await Promise.all([
    prisma.profile.findUnique({ where: { email: email('user')  }, select: { id: true } }),
    prisma.profile.findUnique({ where: { email: email('admin') }, select: { id: true } }),
  ]);
  if (!userProfile || !adminProfile) throw new Error('Profile lookup failed');

  // Create department
  const dept = await prisma.department.create({
    data: { name: `Step3Dept${SUFFIX}` },
  });

  // Add user as ACTIVE MEMBER
  await prisma.departmentMember.create({
    data: { userId: userProfile.id, departmentId: dept.id, status: 'ACTIVE', role: 'MEMBER' },
  });

  console.log('  ✓ 3 users created (user, admin, nonmember)');
  console.log(`  ✓ Department created: ${dept.id}`);
  console.log('  ✓ user added as ACTIVE MEMBER');

  return {
    userToken,
    userId:         userProfile.id,
    adminToken,
    adminId:        adminProfile.id,
    nonMemberToken,
    deptId:         dept.id,
  };
}

// ─── GROUP V: Validation ──────────────────────────────────────

async function testValidation(s: Setup): Promise<void> {
  console.log('\n=== GROUP V: Validation ===');

  // V1: invalid UUID for departmentId → 400
  const v1 = await api('GET', '/api/analytics/departments/not-a-uuid/summary', { token: s.userToken });
  check('V1 invalid UUID departmentId → 400', v1.status === 400);

  // V2: admin dept list page=0 → 400
  const v2 = await api('GET', '/api/admin/analytics/departments?page=0', { token: s.adminToken });
  check('V2 admin dept list page=0 → 400', v2.status === 400);

  // V3: admin dept list limit=101 → 400
  const v3 = await api('GET', '/api/admin/analytics/departments?limit=101', { token: s.adminToken });
  check('V3 admin dept list limit=101 → 400', v3.status === 400);

  // V4: dept completion missing startDate → 400
  const v4 = await api('GET', `/api/analytics/departments/${s.deptId}/completion?endDate=${todayStr}`, { token: s.userToken });
  check('V4 dept completion missing startDate → 400', v4.status === 400);

  // V5: dept completion bad date format → 400
  const v5 = await api('GET', `/api/analytics/departments/${s.deptId}/completion?startDate=01-01-2026&endDate=${todayStr}`, { token: s.userToken });
  check('V5 dept completion bad date format → 400', v5.status === 400);
}

// ─── GROUP A: Authorization ───────────────────────────────────

async function testAuth(s: Setup): Promise<void> {
  console.log('\n=== GROUP A: Authorization ===');
  const range = `startDate=${daysAgo(30)}&endDate=${todayStr}`;

  // Unauthenticated
  const a1 = await api('GET', `/api/analytics/departments/${s.deptId}/summary`);
  check('A1 unauthenticated /departments/:id/summary → 401', a1.status === 401);

  const a2 = await api('GET', `/api/analytics/departments/${s.deptId}/completion?${range}`);
  check('A2 unauthenticated /departments/:id/completion → 401', a2.status === 401);

  const a3 = await api('GET', '/api/admin/analytics/departments');
  check('A3 unauthenticated /admin/analytics/departments → 401', a3.status === 401);

  const a4 = await api('GET', `/api/admin/analytics/departments/${s.deptId}/summary`);
  check('A4 unauthenticated /admin/analytics/departments/:id/summary → 401', a4.status === 401);

  // Non-admin on admin endpoints
  const a5 = await api('GET', '/api/admin/analytics/departments', { token: s.userToken });
  check('A5 non-admin /admin/analytics/departments → 403', a5.status === 403);

  // Non-member on user dept endpoints → 403
  const a6 = await api('GET', `/api/analytics/departments/${s.deptId}/summary`, { token: s.nonMemberToken });
  check('A6 non-member /departments/:id/summary → 403', a6.status === 403);

  const a7 = await api('GET', `/api/analytics/departments/${s.deptId}/completion?${range}`, { token: s.nonMemberToken });
  check('A7 non-member /departments/:id/completion → 403', a7.status === 403);

  // Non-existent department → 404
  const fakeDeptId = '00000000-0000-0000-0000-000000000000';
  const a8 = await api('GET', `/api/analytics/departments/${fakeDeptId}/summary`, { token: s.userToken });
  check('A8 non-existent dept /departments/:id/summary → 404', a8.status === 404);

  const a9 = await api('GET', `/api/admin/analytics/departments/${fakeDeptId}/summary`, { token: s.adminToken });
  check('A9 non-existent dept /admin/analytics/departments/:id/summary → 404', a9.status === 404);

  // Admin can access admin endpoints (no membership check)
  const a10 = await api('GET', `/api/admin/analytics/departments/${s.deptId}/summary`, { token: s.adminToken });
  check('A10 admin /admin/analytics/departments/:id/summary → 200 (no membership needed)', a10.status === 200);

  // Active member can access user dept endpoints
  const a11 = await api('GET', `/api/analytics/departments/${s.deptId}/summary`, { token: s.userToken });
  check('A11 active member /departments/:id/summary → 200', a11.status === 200);
}

// ─── GROUP M: Metrics ─────────────────────────────────────────

async function testMetrics(s: Setup): Promise<void> {
  console.log('\n=== GROUP M: Metrics correctness ===');

  const now            = new Date();
  const twoDaysAgo     = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const createdBefore  = new Date(now.getTime() - 60_000);

  // Seed tasks in the department
  await prisma.task.createMany({
    data: [
      // overdue todo (deadline in past)
      { profileId: s.userId, departmentId: s.deptId, title: 'M3-overdue-todo',  status: 'todo',  priority: 'medium', description: '', deadline: twoDaysAgo, createdAt: createdBefore },
      // overdue doing (deadline in past)
      { profileId: s.userId, departmentId: s.deptId, title: 'M3-overdue-doing', status: 'doing', priority: 'medium', description: '', deadline: twoDaysAgo, createdAt: createdBefore },
      // due-soon todo (deadline within 7 days)
      { profileId: s.userId, departmentId: s.deptId, title: 'M3-duesoon-todo',  status: 'todo',  priority: 'medium', description: '', deadline: threeDaysAhead, createdAt: createdBefore },
      // done (completed, no deadline)
      { profileId: s.userId, departmentId: s.deptId, title: 'M3-done',          status: 'done',  priority: 'medium', description: '', completedAt: now, createdAt: createdBefore },
    ],
  });

  // ── Dept summary ──
  const r = await api('GET', `/api/analytics/departments/${s.deptId}/summary`, { token: s.userToken });
  check('M1 dept summary status 200', r.status === 200);
  check('M2 success=true', r.body['success'] === true);

  const data = (r.body as { data: JsonBody }).data;
  check('M3 timezone=UTC', data['timezone'] === 'UTC');

  const tasks = data['tasks'] as JsonBody;
  check('M4 tasks.total = 4',   tasks['total']   === 4);
  check('M5 tasks.todo = 2',    tasks['todo']    === 2);
  check('M6 tasks.doing = 1',   tasks['doing']   === 1);
  check('M7 tasks.done = 1',    tasks['done']    === 1);
  check('M8 tasks.overdue = 2', tasks['overdue'] === 2);
  check('M9 tasks.dueSoon = 1', tasks['dueSoon'] === 1);

  const members = data['members'] as JsonBody;
  check('M10 members.active = 1', members['active'] === 1);

  // ── Dept completion stats ──
  const rc = await api('GET', `/api/analytics/departments/${s.deptId}/completion?startDate=${daysAgo(7)}&endDate=${todayStr}`, { token: s.userToken });
  check('M11 dept completion status 200', rc.status === 200);

  const dc = (rc.body as { data: JsonBody }).data;
  const tc = dc['tasks'] as JsonBody;
  check('M12 dept completion: created = 4',    tc['created']  === 4);
  check('M13 dept completion: completed = 1',  tc['completed'] === 1);
  // completionRate = 1/4 = 0.25
  check('M14 dept completion: completionRate = 0.25', tc['completionRate'] === 0.25);
  check('M15 dept completion: averageCompletionTimeMs >= 0',
    typeof tc['averageCompletionTimeMs'] === 'number' && (tc['averageCompletionTimeMs'] as number) >= 0);
}

// ─── GROUP L: Admin dept list ─────────────────────────────────

async function testAdminDeptList(s: Setup): Promise<void> {
  console.log('\n=== GROUP L: Admin dept list ===');

  const r = await api('GET', '/api/admin/analytics/departments?page=1&limit=10', { token: s.adminToken });
  check('L1 admin dept list status 200', r.status === 200);
  check('L2 success=true', r.body['success'] === true);

  const data = r.body['data'] as JsonBody;
  check('L3 data.page is number',   typeof data['page']  === 'number');
  check('L4 data.limit is number',  typeof data['limit'] === 'number');
  check('L5 data.total is number',  typeof data['total'] === 'number');
  check('L6 data.departments is array', Array.isArray(data['departments']));

  const depts = data['departments'] as JsonBody[];
  const found = depts.find(d => d['id'] === s.deptId);
  check('L7 seeded dept appears in list', found !== undefined);

  if (found !== undefined) {
    check('L8 dept item has id (string)',   typeof found['id']   === 'string');
    check('L9 dept item has name (string)', typeof found['name'] === 'string');
    check('L10 dept item has tasks.total',  typeof (found['tasks'] as JsonBody)['total']   === 'number');
    check('L11 dept item has members.active', typeof (found['members'] as JsonBody)['active'] === 'number');
    // 4 tasks seeded in this dept
    check('L12 dept tasks.total = 4',        (found['tasks'] as JsonBody)['total']   === 4);
    check('L13 dept members.active = 1',     (found['members'] as JsonBody)['active'] === 1);
  }

  // Default query params (no page/limit) → still valid
  const r2 = await api('GET', '/api/admin/analytics/departments', { token: s.adminToken });
  check('L14 no query params uses defaults → 200', r2.status === 200);
}

// ─── GROUP S: Response shape ──────────────────────────────────

async function testShape(s: Setup): Promise<void> {
  console.log('\n=== GROUP S: Response shape ===');

  // Admin dept summary shape
  const ra = await api('GET', `/api/admin/analytics/departments/${s.deptId}/summary`, { token: s.adminToken });
  const da = (ra.body as { data: JsonBody }).data;
  const ta = da['tasks'] as JsonBody;
  check('S1  admin dept summary: success=true',        ra.body['success'] === true);
  check('S2  admin dept summary: timezone=UTC',         da['timezone']    === 'UTC');
  check('S3  admin dept summary: name is string',       typeof da['name'] === 'string');
  check('S4  admin dept summary: tasks.total is number', typeof ta['total']   === 'number');
  check('S5  admin dept summary: tasks.todo is number',  typeof ta['todo']    === 'number');
  check('S6  admin dept summary: tasks.doing is number', typeof ta['doing']   === 'number');
  check('S7  admin dept summary: tasks.done is number',  typeof ta['done']    === 'number');
  check('S8  admin dept summary: tasks.overdue is number', typeof ta['overdue'] === 'number');
  check('S9  admin dept summary: tasks.dueSoon is number', typeof ta['dueSoon'] === 'number');
  check('S10 admin dept summary: members.active is number',
    typeof (da['members'] as JsonBody)['active'] === 'number');

  // User dept completion shape
  const rc = await api('GET', `/api/analytics/departments/${s.deptId}/completion?startDate=${daysAgo(30)}&endDate=${todayStr}`, { token: s.userToken });
  const dc = (rc.body as { data: JsonBody }).data;
  const tc = dc['tasks'] as JsonBody;
  check('S11 user dept completion: success=true',                     rc.body['success'] === true);
  check('S12 user dept completion: timezone=UTC',                     dc['timezone']    === 'UTC');
  check('S13 user dept completion: period.startDate present',         typeof (dc['period'] as JsonBody)['startDate'] === 'string');
  check('S14 user dept completion: period.endDate present',           typeof (dc['period'] as JsonBody)['endDate']   === 'string');
  check('S15 user dept completion: tasks.created is number',          typeof tc['created']        === 'number');
  check('S16 user dept completion: tasks.completed is number',        typeof tc['completed']      === 'number');
  check('S17 user dept completion: tasks.completionRate is number',   typeof tc['completionRate'] === 'number');
  check('S18 user dept completion: averageCompletionTimeMs type ok',
    tc['averageCompletionTimeMs'] === null || typeof tc['averageCompletionTimeMs'] === 'number');
  check('S19 user dept completion: NO byStatus field (user endpoint)', !('byStatus' in tc));
}

// ─── CLEANUP ──────────────────────────────────────────────────

async function cleanup(s: Setup | null): Promise<void> {
  console.log('\n=== CLEANUP ===');
  if (s !== null) {
    await prisma.department.deleteMany({ where: { id: s.deptId } });
  }
  for (const role of ['user', 'admin', 'nonmember']) {
    await prisma.profile.deleteMany({ where: { email: email(role) } });
  }
  console.log('  Cleanup complete');
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('==========================================');
  console.log('  STEP 3 — Department Analytics');
  console.log('==========================================');

  let s: Setup | null = null;

  try {
    s = await setup();
    await testValidation(s);
    await testAuth(s);
    await testMetrics(s);
    await testAdminDeptList(s);
    await testShape(s);
  } catch (err) {
    console.error('Unexpected error during tests:', err);
    failed++;
  } finally {
    await cleanup(s);
  }

  console.log('\n==========================================');
  console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
  if (failed === 0) {
    console.log('  ✅  ALL TESTS PASSED — STEP 3 verified');
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
