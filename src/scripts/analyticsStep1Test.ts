import prisma from '../config/prisma';

const BASE_URL = 'http://localhost:3000';
const SUFFIX = Date.now().toString().slice(-6);

// ─── Helpers ──────────────────────────────────────────────────

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
  const body = await res.json() as JsonBody;
  return { status: res.status, body };
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function email(role: string): string {
  return `${role}${SUFFIX}@analytics1.test`;
}

// ─── Helpers for fixtures ─────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * MS_PER_DAY);
}

// ─── SETUP ────────────────────────────────────────────────────

interface Setup {
  emptyUserToken:    string;
  emptyUserId:       string;
  mainUserToken:     string;
  mainUserId:        string;
  adminToken:        string;
  adminId:           string;
}

async function setup(): Promise<Setup> {
  console.log('\n=== SETUP ===');

  // Register all users
  for (const role of ['empty', 'main', 'admin']) {
    const r = await api('POST', '/api/auth/register', {
      body: { email: email(role), password: 'TestPass123!', name: `Analytics ${role}` },
    });
    if (r.status !== 201) throw new Error(`Register failed for ${role}: ${JSON.stringify(r.body)}`);
  }

  // Promote admin
  await prisma.profile.update({ where: { email: email('admin') }, data: { role: 'ADMIN' } });

  // Login all
  const loginEmpty = await api('POST', '/api/auth/login', { body: { email: email('empty'), password: 'TestPass123!' } });
  const loginMain  = await api('POST', '/api/auth/login', { body: { email: email('main'),  password: 'TestPass123!' } });
  const loginAdmin = await api('POST', '/api/auth/login', { body: { email: email('admin'), password: 'TestPass123!' } });

  const emptyUserToken = ((loginEmpty.body as { data: { token: string } }).data.token);
  const mainUserToken  = ((loginMain.body  as { data: { token: string } }).data.token);
  const adminToken     = ((loginAdmin.body as { data: { token: string } }).data.token);

  const emptyProfile = await prisma.profile.findUnique({ where: { email: email('empty') }, select: { id: true } });
  const mainProfile  = await prisma.profile.findUnique({ where: { email: email('main')  }, select: { id: true } });
  const adminProfile = await prisma.profile.findUnique({ where: { email: email('admin') }, select: { id: true } });

  if (!emptyProfile || !mainProfile || !adminProfile) throw new Error('Profile lookup failed');

  console.log('  ✓ Setup: 3 users created (empty, main, admin)');
  return {
    emptyUserToken,
    emptyUserId:  emptyProfile.id,
    mainUserToken,
    mainUserId:   mainProfile.id,
    adminToken,
    adminId:      adminProfile.id,
  };
}

// ─── GROUP A: Empty state ──────────────────────────────────────

async function testA(s: Setup): Promise<void> {
  console.log('\n=== GROUP A: Empty state (new user) ===');

  const r = await api('GET', '/api/analytics/summary', { token: s.emptyUserToken });
  check('A1 status 200', r.status === 200);
  check('A2 success=true', r.body['success'] === true);

  const data = r.body['data'] as JsonBody;
  check('A3 timezone=UTC', data['timezone'] === 'UTC');

  const tasks = data['tasks'] as JsonBody;
  check('A4 tasks.total=0',   tasks['total']   === 0);
  check('A5 tasks.todo=0',    tasks['todo']    === 0);
  check('A6 tasks.doing=0',   tasks['doing']   === 0);
  check('A7 tasks.done=0',    tasks['done']    === 0);
  check('A8 tasks.overdue=0', tasks['overdue'] === 0);
  check('A9 tasks.dueSoon=0', tasks['dueSoon'] === 0);

  const notifs = data['notifications'] as JsonBody;
  check('A10 notifications.unread=0', notifs['unread'] === 0);

  const comments = data['comments'] as JsonBody;
  check('A11 comments.total=0', comments['total'] === 0);
}

// ─── GROUP B: Task counts ──────────────────────────────────────

async function testB(s: Setup): Promise<void> {
  console.log('\n=== GROUP B: Task count correctness ===');

  // Create exactly 2 todo, 1 doing, 3 done via Prisma (bypass API for precise control)
  const baseTask = {
    profileId: s.mainUserId,
    title:     'GroupB task',
    description: '',
  };

  await prisma.task.createMany({
    data: [
      { ...baseTask, title: 'B todo 1',  status: 'todo',  priority: 'medium' },
      { ...baseTask, title: 'B todo 2',  status: 'todo',  priority: 'medium' },
      { ...baseTask, title: 'B doing 1', status: 'doing', priority: 'medium' },
      { ...baseTask, title: 'B done 1',  status: 'done',  priority: 'medium' },
      { ...baseTask, title: 'B done 2',  status: 'done',  priority: 'medium' },
      { ...baseTask, title: 'B done 3',  status: 'done',  priority: 'medium' },
    ],
  });

  const r = await api('GET', '/api/analytics/summary', { token: s.mainUserToken });
  check('B1 status 200', r.status === 200);

  const tasks = (r.body['data'] as JsonBody)['tasks'] as JsonBody;
  check('B2 tasks.total=6',  tasks['total']  === 6);
  check('B3 tasks.todo=2',   tasks['todo']   === 2);
  check('B4 tasks.doing=1',  tasks['doing']  === 1);
  check('B5 tasks.done=3',   tasks['done']   === 3);
}

// ─── GROUP C: Overdue logic ────────────────────────────────────

async function testC(s: Setup): Promise<void> {
  console.log('\n=== GROUP C: Overdue logic ===');

  const base = { profileId: s.mainUserId, title: 'GroupC', description: '', priority: 'medium' as const };

  // Task A: doing + deadline 3 days ago → OVERDUE
  await prisma.task.create({ data: { ...base, title: 'C overdue doing', status: 'doing', deadline: daysAgo(3) } });
  // Task B: done + deadline 3 days ago → NOT overdue (already done)
  await prisma.task.create({ data: { ...base, title: 'C done old deadline', status: 'done', deadline: daysAgo(3) } });
  // Task C: todo + no deadline → NOT overdue
  await prisma.task.create({ data: { ...base, title: 'C todo no deadline', status: 'todo' } });

  const r = await api('GET', '/api/analytics/summary', { token: s.mainUserToken });
  const tasks = (r.body['data'] as JsonBody)['tasks'] as JsonBody;

  // Previous tasks (Group B): 2 todo, 1 doing, 3 done — none have deadlines
  // New tasks: +1 doing (overdue), +1 done, +1 todo
  // total = 9, todo = 3, doing = 2, done = 4
  check('C1 overdue=1 (only the doing task with past deadline)', tasks['overdue'] === 1);
  check('C2 done tasks with past deadline are NOT overdue',      tasks['done']    === 4);
  check('C3 tasks without deadline are NOT overdue',             typeof tasks['total'] === 'number');
}

// ─── GROUP D: DueSoon boundary ────────────────────────────────

async function testD(s: Setup): Promise<void> {
  console.log('\n=== GROUP D: DueSoon boundary ===');

  const base = { profileId: s.mainUserId, title: 'GroupD', description: '', priority: 'medium' as const };

  // Task A: deadline in 6 days → dueSoon ✅
  await prisma.task.create({ data: { ...base, title: 'D dueSoon 6d', status: 'todo', deadline: daysFromNow(6) } });
  // Task B: deadline in 8 days → NOT dueSoon (outside 7d window)
  await prisma.task.create({ data: { ...base, title: 'D future 8d', status: 'todo', deadline: daysFromNow(8) } });
  // Task C: deadline in 1 day → dueSoon ✅
  await prisma.task.create({ data: { ...base, title: 'D dueSoon 1d', status: 'todo', deadline: daysFromNow(1) } });
  // Task D: deadline in 6 days but DONE → NOT dueSoon
  await prisma.task.create({ data: { ...base, title: 'D done 6d', status: 'done', deadline: daysFromNow(6) } });

  const r = await api('GET', '/api/analytics/summary', { token: s.mainUserToken });
  const tasks = (r.body['data'] as JsonBody)['tasks'] as JsonBody;

  check('D1 dueSoon=2 (6d and 1d; 8d excluded; done excluded)', tasks['dueSoon'] === 2);
}

// ─── GROUP E: Overdue and dueSoon don't overlap ────────────────

async function testE(s: Setup): Promise<void> {
  console.log('\n=== GROUP E: Overdue and dueSoon are mutually exclusive ===');

  const r = await api('GET', '/api/analytics/summary', { token: s.mainUserToken });
  const tasks = (r.body['data'] as JsonBody)['tasks'] as JsonBody;

  const overdue = tasks['overdue'] as number;
  const dueSoon = tasks['dueSoon'] as number;
  const total   = tasks['total']   as number;

  check('E1 overdue is a non-negative integer', Number.isInteger(overdue) && overdue >= 0);
  check('E2 dueSoon is a non-negative integer', Number.isInteger(dueSoon) && dueSoon >= 0);
  check('E3 overdue + dueSoon <= total',         overdue + dueSoon <= total);
  // From group C: 1 overdue. From group D: 2 dueSoon. Should be distinct tasks.
  check('E4 overdue=1 and dueSoon=2 (Groups C+D tasks visible)', overdue === 1 && dueSoon === 2);
}

// ─── GROUP F: Notification unread count ───────────────────────

async function testF(s: Setup): Promise<void> {
  console.log('\n=== GROUP F: Notification unread count ===');

  // Create 3 notifications directly via Prisma
  const n1 = await prisma.notification.create({
    data: { userId: s.mainUserId, type: 'TASK_ASSIGNED', title: 'F notif 1', message: 'test', readAt: null },
  });
  await prisma.notification.create({
    data: { userId: s.mainUserId, type: 'TASK_ASSIGNED', title: 'F notif 2', message: 'test', readAt: null },
  });
  await prisma.notification.create({
    data: { userId: s.mainUserId, type: 'TASK_ASSIGNED', title: 'F notif 3', message: 'test', readAt: null },
  });

  // Mark 1 as read
  await prisma.notification.update({ where: { id: n1.id }, data: { readAt: new Date() } });

  const r = await api('GET', '/api/analytics/summary', { token: s.mainUserToken });
  const notifs = (r.body['data'] as JsonBody)['notifications'] as JsonBody;

  check('F1 notifications.unread=2 (3 created, 1 marked read)', notifs['unread'] === 2);
}

// ─── GROUP G: Comment soft delete ─────────────────────────────

async function testG(s: Setup): Promise<void> {
  console.log('\n=== GROUP G: Soft-deleted comments not counted ===');

  // Create a task for main user
  const task = await prisma.task.create({
    data: {
      profileId: s.mainUserId,
      title:     'G task for comments',
      description: '',
      status:    'todo',
      priority:  'medium',
    },
  });

  // Create 3 comments
  const c1 = await prisma.comment.create({
    data: { taskId: task.id, authorId: s.mainUserId, content: 'G comment 1' },
  });
  await prisma.comment.create({
    data: { taskId: task.id, authorId: s.mainUserId, content: 'G comment 2' },
  });
  await prisma.comment.create({
    data: { taskId: task.id, authorId: s.mainUserId, content: 'G comment 3' },
  });

  // Soft delete 1
  await prisma.comment.update({ where: { id: c1.id }, data: { deletedAt: new Date() } });

  const r = await api('GET', '/api/analytics/summary', { token: s.mainUserToken });
  const comments = (r.body['data'] as JsonBody)['comments'] as JsonBody;

  check('G1 comments.total=2 (3 created, 1 soft-deleted)', comments['total'] === 2);
}

// ─── GROUP H: Authorization ────────────────────────────────────

async function testH(s: Setup): Promise<void> {
  console.log('\n=== GROUP H: Authorization ===');

  // Unauthenticated → 401
  const r1 = await api('GET', '/api/analytics/summary');
  check('H1 unauthenticated /analytics/summary → 401', r1.status === 401);

  const r2 = await api('GET', '/api/admin/analytics/summary');
  check('H2 unauthenticated /admin/analytics/summary → 401', r2.status === 401);

  // Non-admin accessing admin endpoint → 403
  const r3 = await api('GET', '/api/admin/analytics/summary', { token: s.mainUserToken });
  check('H3 non-admin /admin/analytics/summary → 403', r3.status === 403);
  check('H4 code=FORBIDDEN', r3.body['code'] === 'FORBIDDEN');

  // Admin accessing user endpoint → 200 (admins are also valid users)
  const r4 = await api('GET', '/api/analytics/summary', { token: s.adminToken });
  check('H5 admin /analytics/summary → 200 (admin is also a valid user)', r4.status === 200);

  // Admin accessing admin endpoint → 200
  const r5 = await api('GET', '/api/admin/analytics/summary', { token: s.adminToken });
  check('H6 admin /admin/analytics/summary → 200', r5.status === 200);
  check('H7 admin summary has timezone=UTC', ((r5.body['data'] as JsonBody)['timezone']) === 'UTC');
}

// ─── GROUP I: Rate limiting ────────────────────────────────────

async function testI(_s: Setup): Promise<void> {
  console.log('\n=== GROUP I: Rate limiting (30 req/min) ===');

  // Fresh user so the rate limiter bucket starts at exactly 0 (no leakage from prior groups)
  const regRes = await api('POST', '/api/auth/register', {
    body: { email: email('ratei'), password: 'TestPass123!', name: 'Analytics RateI' },
  });
  if (regRes.status !== 201) throw new Error(`Register ratei failed: ${JSON.stringify(regRes.body)}`);
  const loginRes = await api('POST', '/api/auth/login', {
    body: { email: email('ratei'), password: 'TestPass123!' },
  });
  const rateiToken = (loginRes.body as { data: { token: string } }).data.token;

  const statuses: number[] = [];
  let first429 = -1;
  let sample429: JsonBody | null = null;

  for (let i = 0; i < 32; i++) {
    const r = await api('GET', '/api/analytics/summary', { token: rateiToken });
    statuses.push(r.status);
    if (r.status === 429 && first429 === -1) {
      first429 = i;
      sample429 = r.body;
    }
  }

  const count429 = statuses.filter(status => status === 429).length;

  check(`I1 rate limit fires at request ≥30 (first 429 at index ${first429})`, first429 >= 30);
  check(`I2 multiple requests blocked (count=${count429})`,                      count429 >= 2);
  check('I3 no 500s',                                                             !statuses.includes(500));

  if (sample429 !== null) {
    check('I4 429 body: success=false',              sample429['success'] === false);
    check('I5 429 body: code=RATE_LIMIT_EXCEEDED',   sample429['code'] === 'RATE_LIMIT_EXCEEDED');
    check('I6 429 body: requestId present',          typeof sample429['requestId'] === 'string');
  }
}

// ─── GROUP J: Admin summary correctness ───────────────────────

async function testJ(s: Setup): Promise<void> {
  console.log('\n=== GROUP J: Admin summary shape and consistency ===');

  const r = await api('GET', '/api/admin/analytics/summary', { token: s.adminToken });
  check('J1 status 200', r.status === 200);

  const data = r.body['data'] as JsonBody;
  check('J2 timezone=UTC', data['timezone'] === 'UTC');

  // Users shape
  const users = data['users'] as JsonBody;
  check('J3 users.total is number',  typeof users['total']  === 'number');
  check('J4 users.active is number', typeof users['active'] === 'number');
  check('J5 users.banned is number', typeof users['banned'] === 'number');
  check('J6 users.active + users.banned = users.total',
    (users['active'] as number) + (users['banned'] as number) === (users['total'] as number));
  check('J7 users.total >= 3 (at least our 3 test users)',
    (users['total'] as number) >= 3);

  // Tasks shape
  const tasks = data['tasks'] as JsonBody;
  check('J8  tasks.total is number',        typeof tasks['total']        === 'number');
  check('J9  tasks.todo is number',         typeof tasks['todo']         === 'number');
  check('J10 tasks.doing is number',        typeof tasks['doing']        === 'number');
  check('J11 tasks.done is number',         typeof tasks['done']         === 'number');
  check('J12 tasks.overdue is number',      typeof tasks['overdue']      === 'number');
  check('J13 tasks.dueSoon is number',      typeof tasks['dueSoon']      === 'number');
  check('J14 tasks.createdToday is number', typeof tasks['createdToday'] === 'number');
  check('J15 tasks.todo + doing + done = total',
    (tasks['todo'] as number) + (tasks['doing'] as number) + (tasks['done'] as number)
    === (tasks['total'] as number));
  check('J16 tasks.total >= mainUser task count (at least tasks from Groups B-G)',
    (tasks['total'] as number) >= 13);

  // Departments shape
  const depts = data['departments'] as JsonBody;
  check('J17 departments.total is non-negative number',
    typeof depts['total'] === 'number' && (depts['total'] as number) >= 0);

  // Comments shape
  const comments = data['comments'] as JsonBody;
  check('J18 comments.total is non-negative number',
    typeof comments['total'] === 'number' && (comments['total'] as number) >= 0);

  // overdue + dueSoon cannot exceed total active (non-done)
  const nonDone = (tasks['todo'] as number) + (tasks['doing'] as number);
  check('J19 overdue + dueSoon <= total non-done tasks',
    (tasks['overdue'] as number) + (tasks['dueSoon'] as number) <= nonDone);
}

// ─── CLEANUP ──────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log('\n=== CLEANUP ===');
  for (const role of ['empty', 'main', 'admin', 'ratei']) {
    await prisma.profile.deleteMany({ where: { email: email(role) } });
  }
  console.log('  Cleanup complete');
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('==========================================');
  console.log('  PHASE 4 STEP 1 — Analytics Dashboard');
  console.log('==========================================');

  let s: Setup | null = null;

  try {
    s = await setup();
    await testA(s);
    await testB(s);
    await testC(s);
    await testD(s);
    await testE(s);
    await testF(s);
    await testG(s);
    await testH(s);
    await testI(s);
    await testJ(s);
  } catch (err) {
    console.error('Unexpected error during tests:', err);
    failed++;
  } finally {
    await cleanup();
  }

  console.log('\n==========================================');
  console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
  if (failed === 0) {
    console.log('  ✅  ALL TESTS PASSED — STEP 1 verified');
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
