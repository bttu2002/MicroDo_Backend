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
  const body = await res.json() as JsonBody;
  return { status: res.status, body };
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function email(role: string): string {
  return `${role}${SUFFIX}@step15.test`;
}

function isDateString(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const t = Date.parse(v);
  return !isNaN(t);
}

// ─── SETUP ────────────────────────────────────────────────────

interface Setup { token: string; userId: string }

async function setup(): Promise<Setup> {
  console.log('\n=== SETUP ===');
  const reg = await api('POST', '/api/auth/register', {
    body: { email: email('user'), password: 'TestPass123!', name: 'Step15 User' },
  });
  if (reg.status !== 201) throw new Error(`Register failed: ${JSON.stringify(reg.body)}`);

  const login = await api('POST', '/api/auth/login', {
    body: { email: email('user'), password: 'TestPass123!' },
  });
  const token  = (login.body as { data: { token: string } }).data.token;
  const profile = await prisma.profile.findUnique({ where: { email: email('user') }, select: { id: true } });
  if (!profile) throw new Error('Profile lookup failed');
  console.log('  ✓ User created and logged in');
  return { token, userId: profile.id };
}

// ─── Helper: create task via API ─────────────────────────────

async function createTask(token: string, body: JsonBody): Promise<JsonBody> {
  const r = await api('POST', '/api/tasks', { token, body });
  if (r.status !== 201) throw new Error(`createTask failed: ${JSON.stringify(r.body)}`);
  return (r.body as { data: JsonBody }).data;
}

async function updateTask(token: string, id: string, body: JsonBody): Promise<JsonBody> {
  const r = await api('PUT', `/api/tasks/${id}`, { token, body });
  if (r.status !== 200) throw new Error(`updateTask failed (${r.status}): ${JSON.stringify(r.body)}`);
  return (r.body as { data: JsonBody }).data;
}

// ─── GROUP C: Create scenarios ────────────────────────────────

async function testCreate(s: Setup): Promise<void> {
  console.log('\n=== GROUP C: Create completedAt ===');

  // C1: default status (todo)
  const c1 = await createTask(s.token, { title: 'C1 default todo' });
  check('C1 create no status → completedAt=null', c1['completedAt'] === null);

  // C2: explicit doing
  const c2 = await createTask(s.token, { title: 'C2 doing', status: 'doing' });
  check('C2 create doing → completedAt=null', c2['completedAt'] === null);

  // C3: explicit done
  const c3 = await createTask(s.token, { title: 'C3 done', status: 'done' });
  check('C3 create done → completedAt is date string', isDateString(c3['completedAt']));
}

// ─── GROUP U: Update transition scenarios ─────────────────────

async function testUpdate(s: Setup): Promise<void> {
  console.log('\n=== GROUP U: Update completedAt transitions ===');

  // U1: todo → done
  const u1task = await createTask(s.token, { title: 'U1 task', status: 'todo' });
  const u1 = await updateTask(s.token, u1task['_id'] as string, { status: 'done' });
  check('U1 todo → done: completedAt is date string', isDateString(u1['completedAt']));

  // U2: doing → done
  const u2task = await createTask(s.token, { title: 'U2 task', status: 'doing' });
  const u2 = await updateTask(s.token, u2task['_id'] as string, { status: 'done' });
  check('U2 doing → done: completedAt is date string', isDateString(u2['completedAt']));

  // U3: done → todo (clear)
  const u3task = await createTask(s.token, { title: 'U3 task', status: 'done' });
  const u3 = await updateTask(s.token, u3task['_id'] as string, { status: 'todo' });
  check('U3 done → todo: completedAt=null', u3['completedAt'] === null);

  // U4: done → doing (clear)
  const u4task = await createTask(s.token, { title: 'U4 task', status: 'done' });
  const u4 = await updateTask(s.token, u4task['_id'] as string, { status: 'doing' });
  check('U4 done → doing: completedAt=null', u4['completedAt'] === null);

  // U5: todo → doing (completedAt stays null)
  const u5task = await createTask(s.token, { title: 'U5 task', status: 'todo' });
  const u5 = await updateTask(s.token, u5task['_id'] as string, { status: 'doing' });
  check('U5 todo → doing: completedAt=null', u5['completedAt'] === null);

  // U6: done → done (idempotent — original completedAt preserved, not reset)
  const u6task = await createTask(s.token, { title: 'U6 task', status: 'done' });
  const originalCompletedAt = u6task['completedAt'] as string;
  // Small delay to ensure clock would advance if reset were happening
  await new Promise(r => setTimeout(r, 50));
  const u6 = await updateTask(s.token, u6task['_id'] as string, { status: 'done' });
  check('U6 done → done: completedAt not reset',
    u6['completedAt'] === originalCompletedAt);

  // U7: update non-status fields → completedAt unchanged
  const u7task = await createTask(s.token, { title: 'U7 task', status: 'done' });
  const u7CompletedAt = u7task['completedAt'] as string;
  const u7 = await updateTask(s.token, u7task['_id'] as string, { title: 'U7 renamed', priority: 'high' });
  check('U7 non-status update: completedAt unchanged', u7['completedAt'] === u7CompletedAt);
}

// ─── GROUP D: DTO exposure ────────────────────────────────────

async function testDTOExposure(s: Setup): Promise<void> {
  console.log('\n=== GROUP D: DTO completedAt exposure ===');

  // D1: createTask response has completedAt field
  const created = await createTask(s.token, { title: 'D1 dto task', status: 'done' });
  check('D1 createTask response has completedAt key', 'completedAt' in created);
  check('D2 createTask done → completedAt is date string', isDateString(created['completedAt']));

  // D3: updateTask response has completedAt
  const updated = await updateTask(s.token, created['_id'] as string, { status: 'todo' });
  check('D3 updateTask response has completedAt key', 'completedAt' in updated);
  check('D4 updateTask todo → completedAt=null', updated['completedAt'] === null);

  // D5: getTasks list items expose completedAt (no getTaskById route exists yet)
  const r5 = await api('GET', '/api/tasks', { token: s.token });
  const tasks = (r5.body as { data: JsonBody[] }).data;
  const first = tasks[0];
  check('D5 getTasks list items have completedAt key',  first !== undefined && 'completedAt' in first);
  check('D6 completedAt value is Date string or null',
    first !== undefined && (first['completedAt'] === null || isDateString(first['completedAt'])));
}

// ─── GROUP S: Server-managed only (client cannot inject) ──────

async function testServerManaged(s: Setup): Promise<void> {
  console.log('\n=== GROUP S: completedAt is server-managed ===');

  // Client tries to inject completedAt via create
  const injectedDate = '2020-01-01T00:00:00.000Z';
  const c = await createTask(s.token, { title: 'S1 inject create', status: 'todo', completedAt: injectedDate });
  check('S1 client cannot inject completedAt via create (stays null)', c['completedAt'] === null);

  // Client tries to inject completedAt via update
  const task = await createTask(s.token, { title: 'S2 inject update', status: 'todo' });
  const u = await updateTask(s.token, task['_id'] as string, { status: 'todo', completedAt: injectedDate });
  check('S2 client cannot inject completedAt via update (stays null)', u['completedAt'] === null);

  // Client tries to inject completedAt while transitioning to done — server timestamp wins
  const u2 = await updateTask(s.token, task['_id'] as string, { status: 'done', completedAt: injectedDate });
  check('S3 transition to done: completedAt is server time not injected value',
    u2['completedAt'] !== injectedDate && isDateString(u2['completedAt']));
}

// ─── CLEANUP ──────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  console.log('\n=== CLEANUP ===');
  await prisma.profile.deleteMany({ where: { email: email('user') } });
  console.log('  Cleanup complete');
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('==========================================');
  console.log('  STEP 1.5 — completedAt lifecycle');
  console.log('==========================================');

  let s: Setup | null = null;

  try {
    s = await setup();
    await testCreate(s);
    await testUpdate(s);
    await testDTOExposure(s);
    await testServerManaged(s);
  } catch (err) {
    console.error('Unexpected error:', err);
    failed++;
  } finally {
    await cleanup();
  }

  console.log('\n==========================================');
  console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
  if (failed === 0) {
    console.log('  ✅  ALL TESTS PASSED — STEP 1.5 verified');
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
