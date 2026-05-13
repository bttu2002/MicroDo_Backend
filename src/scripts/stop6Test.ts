import prisma from '../config/prisma';
import fs from 'fs';
import path from 'path';

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

  const fetchOpts: RequestInit = {
    method,
    headers,
    ...(opts?.body !== undefined && { body: JSON.stringify(opts.body) }),
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, fetchOpts);
  const body = await res.json() as JsonBody;
  return { status: res.status, body };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// ─── SETUP ────────────────────────────────────────────────────

interface Emails {
  smoke: string;
  a: string;
  b: string;
}

async function setup(): Promise<Emails> {
  console.log('\n=== SETUP ===');

  const emails: Emails = {
    smoke: `smoke${SUFFIX}@stop6.test`,
    a: `usera${SUFFIX}@stop6.test`,
    b: `userb${SUFFIX}@stop6.test`,
  };

  for (const email of Object.values(emails)) {
    const res = await api('POST', '/api/auth/register', {
      body: { email, password: 'TestPass123!', name: `Stop6 ${email.split('@')[0] ?? email}` },
    });
    if (res.status !== 201) throw new Error(`Register failed for ${email}: ${JSON.stringify(res.body)}`);
  }

  await prisma.profile.update({ where: { email: emails.b }, data: { role: 'ADMIN' } });

  console.log('  ✓ 3 users created; testUserB promoted to ADMIN');
  return emails;
}

// ─── TEST D: Normal requests unaffected ───────────────────────

async function testD(email: string): Promise<void> {
  console.log('\n=== TEST D: Normal requests unaffected ===');

  const login = await api('POST', '/api/auth/login', { body: { email, password: 'TestPass123!' } });
  check('Login succeeds (200)', login.status === 200);
  const token = (login.body as { data: { token: string } }).data.token;

  const taskRes = await api('POST', '/api/tasks', {
    token,
    body: { title: 'Stop6 smoke', description: 'test', status: 'todo', priority: 'medium' },
  });
  check('Create task succeeds (201)', taskRes.status === 201);
  const taskId = (taskRes.body as { data: { _id: string } }).data._id;

  const commentRes = await api('POST', `/api/tasks/${taskId}/comments`, {
    token,
    body: { content: 'Stop6 smoke comment' },
  });
  check('Create comment succeeds (201)', commentRes.status === 201);

  const notifRes = await api('GET', '/api/notifications', { token });
  check('Get notifications succeeds (200)', notifRes.status === 200);
}

// ─── TEST A: Task write limiter ────────────────────────────────

async function testA(email: string): Promise<void> {
  console.log('\n=== TEST A: Task write limiter (60/min) ===');

  const login = await api('POST', '/api/auth/login', { body: { email, password: 'TestPass123!' } });
  const token = (login.body as { data: { token: string } }).data.token;

  const statuses: number[] = [];
  let firstBlocked = -1;
  let sample429: JsonBody | null = null;

  for (let i = 0; i < 65; i++) {
    // Empty body → 400 from validateRequest (no tasks created)
    const res = await api('POST', '/api/tasks', { token, body: {} });
    statuses.push(res.status);
    if (res.status === 429 && firstBlocked === -1) {
      firstBlocked = i;
      sample429 = res.body;
    }
  }

  const count429 = statuses.filter(s => s === 429).length;

  check(`Limiter fires at request ≥60 (first 429 at index ${firstBlocked})`, firstBlocked >= 60);
  check(`Multiple requests blocked (count=${count429})`, count429 >= 4);
  check('No 500s observed', !statuses.includes(500));

  if (sample429 !== null) {
    check('429 body: success=false', sample429['success'] === false);
    check('429 body: code=RATE_LIMIT_EXCEEDED', sample429['code'] === 'RATE_LIMIT_EXCEEDED');
    check('429 body: requestId present', typeof sample429['requestId'] === 'string');
  }
}

// ─── TEST B: Department write limiter ─────────────────────────

async function testB(email: string): Promise<void> {
  console.log('\n=== TEST B: Department write limiter (30/min) ===');

  const login = await api('POST', '/api/auth/login', { body: { email, password: 'TestPass123!' } });
  const token = (login.body as { data: { token: string } }).data.token;

  const statuses: number[] = [];
  let firstBlocked = -1;
  let sample429: JsonBody | null = null;

  for (let i = 0; i < 35; i++) {
    // Empty body → 400 from validateRequest (no departments created)
    const res = await api('POST', '/api/admin/departments', { token, body: {} });
    statuses.push(res.status);
    if (res.status === 429 && firstBlocked === -1) {
      firstBlocked = i;
      sample429 = res.body;
    }
  }

  const count429 = statuses.filter(s => s === 429).length;

  check(`Limiter fires at request ≥30 (first 429 at index ${firstBlocked})`, firstBlocked >= 30);
  check(`Multiple requests blocked (count=${count429})`, count429 >= 4);
  check('No 500s observed', !statuses.includes(500));

  if (sample429 !== null) {
    check('429 body: success=false', sample429['success'] === false);
    check('429 body: code=RATE_LIMIT_EXCEEDED', sample429['code'] === 'RATE_LIMIT_EXCEEDED');
    check('429 body: requestId present', typeof sample429['requestId'] === 'string');
  }
}

// ─── TEST C: Timeout middleware ────────────────────────────────

async function testC(): Promise<void> {
  console.log('\n=== TEST C: Timeout middleware ===');

  const timeoutFile = path.join(__dirname, '../middleware/requestTimeout.ts');
  const serverFile = path.join(__dirname, '../server.ts');

  const origTimeout = fs.readFileSync(timeoutFile, 'utf8');
  const origServer = fs.readFileSync(serverFile, 'utf8');

  // Reduce timeout to 3s for test speed
  const patchedTimeout = origTimeout.replace(
    'const TIMEOUT_MS = 30_000;',
    'const TIMEOUT_MS = 3_000; // STOP6-TEST-ONLY'
  );

  // Inject a route that never responds
  const hangBlock = [
    '// STOP6-TEST-HANG-START',
    "app.get('/api/test-hang', (_req: Request, _res: Response): void => { /* never responds — timeout test */ });",
    '// STOP6-TEST-HANG-END',
    '',
  ].join('\n');

  const patchedServer = origServer.replace(
    '// Health checks — excluded from rate limiting and logging noise',
    hangBlock + '// Health checks — excluded from rate limiting and logging noise'
  );

  check('Timeout patch applied (30_000 → 3_000)', patchedTimeout !== origTimeout);
  check('Server hang route injected', patchedServer !== origServer);

  fs.writeFileSync(timeoutFile, patchedTimeout, 'utf8');
  fs.writeFileSync(serverFile, patchedServer, 'utf8');

  console.log('  Waiting 5s for nodemon to restart...');
  await sleep(5000);

  // Fire the hanging request with 10s safety abort
  let hangResponse: { status: number; body: JsonBody } | null = null;
  let fetchError: string | null = null;
  const start = Date.now();
  const ac = new AbortController();
  const safetyTimer = setTimeout(() => ac.abort(), 10_000);

  try {
    const raw = await fetch(`${BASE_URL}/api/test-hang`, { signal: ac.signal });
    const body = await raw.json() as JsonBody;
    hangResponse = { status: raw.status, body };
  } catch (err) {
    fetchError = String(err);
  } finally {
    clearTimeout(safetyTimer);
  }

  const elapsed = Date.now() - start;

  if (hangResponse !== null) {
    check('Response status 408', hangResponse.status === 408);
    check('code=REQUEST_TIMEOUT', hangResponse.body['code'] === 'REQUEST_TIMEOUT');
    check('requestId present in 408 body', typeof hangResponse.body['requestId'] === 'string');
    check(`Timeout fired after ~3s (elapsed ${elapsed}ms)`, elapsed >= 2500 && elapsed < 6000);
    console.log(`  req.destroy() side effect: none observable (response received cleanly at ${elapsed}ms)`);
  } else {
    console.error(`  Fetch threw: ${fetchError ?? 'unknown'}`);
    check('408 received', false);
    check('requestId present', false);
  }

  // Verify no duplicate: server must still respond
  await sleep(300);
  const health = await api('GET', '/health');
  check('Server alive after timeout (no crash)', health.status === 200);

  // Revert files
  fs.writeFileSync(timeoutFile, origTimeout, 'utf8');
  fs.writeFileSync(serverFile, origServer, 'utf8');

  console.log('  Files reverted. Waiting 5s for nodemon to restore...');
  await sleep(5000);
}

// ─── CLEANUP ──────────────────────────────────────────────────

async function cleanup(emails: Emails): Promise<void> {
  console.log('\n=== CLEANUP ===');
  // Profile delete cascades to tasks and comments (onDelete: Cascade)
  for (const email of Object.values(emails)) {
    await prisma.profile.deleteMany({ where: { email } });
  }
  console.log('  Cleanup complete');
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('==========================================');
  console.log('  STOP 6 — Rate Limiting + Timeout Tests');
  console.log('==========================================');

  let emails: Emails | null = null;

  try {
    emails = await setup();
    await testD(emails.smoke);
    await testA(emails.a);
    await testB(emails.b);
    await testC();
  } catch (err) {
    console.error('Unexpected error during tests:', err);
    failed++;
  } finally {
    if (emails !== null) await cleanup(emails);
  }

  console.log('\n==========================================');
  console.log(`  PASSED: ${passed}  FAILED: ${failed}`);
  if (failed === 0) {
    console.log('  ✅  ALL TESTS PASSED — ready to commit STOP 6');
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
