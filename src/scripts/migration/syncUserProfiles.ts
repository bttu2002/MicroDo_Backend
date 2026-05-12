import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../../models/User';
import prisma from '../../config/prisma';
import connectDB from '../../config/database';

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_RE    = /^\$2[aby]\$\d{2}\$/;
const MONGO_BRIDGE = '@@MONGO_BRIDGE@@';

// Authoritative mongoIds from Phase 4.1a audit — do NOT change
const MONGO_ID = {
  test:    '69c253e44b78b0fe5bff56c5',
  bttu:    '69c3bfacf1e800e4d45925e1',
  admin:   '69d76558170a70f3f742eba7',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidBcrypt(hash: string): boolean {
  return BCRYPT_RE.test(hash);
}

function pass(label: string): void {
  console.log(`  ✓ PASS  ${label}`);
}

function fail(label: string): void {
  console.error(`  ✗ FAIL  ${label}`);
}

// ─── Operation 1: Copy real hash for test@example.com ─────────────────────────

async function syncTestUser(): Promise<void> {
  console.log('\n[Op 1] test@example.com — checking passwordHash...');

  const profile = await prisma.profile.findUnique({
    where:  { email: 'test@example.com' },
    select: { passwordHash: true },
  });

  if (!profile) {
    throw new Error('Prisma Profile for test@example.com not found — unexpected state, aborting');
  }

  if (profile.passwordHash !== MONGO_BRIDGE) {
    if (isValidBcrypt(profile.passwordHash)) {
      console.log('  → Already has valid bcrypt hash. Skipping (idempotent).');
      return;
    }
    throw new Error(
      `Unexpected passwordHash for test@example.com: "${profile.passwordHash.slice(0, 20)}..." ` +
      `— not @@MONGO_BRIDGE@@ and not valid bcrypt. Aborting to avoid unsafe overwrite.`,
    );
  }

  // Fetch real hash from MongoDB (password field is not select:false — returned by default)
  const mongoUser = await User.findOne({ email: 'test@example.com' });
  if (!mongoUser) throw new Error('MongoDB User for test@example.com not found');

  const realHash = mongoUser.password;
  if (!isValidBcrypt(realHash)) {
    throw new Error(
      `MongoDB hash for test@example.com failed bcrypt format check. ` +
      `Got: "${realHash.slice(0, 15)}..." — aborting`,
    );
  }

  await prisma.profile.update({
    where: { email: 'test@example.com' },
    data:  { passwordHash: realHash },
  });

  console.log('  → Copied real bcrypt hash from MongoDB to Prisma. Done.');
}

// ─── Operation 2: Upsert Prisma Profile for admin@microdo.com ─────────────────

async function upsertAdminProfile(): Promise<void> {
  console.log('\n[Op 2] admin@microdo.com — upserting Prisma Profile...');

  const mongoAdmin = await User.findOne({ email: 'admin@microdo.com' });
  if (!mongoAdmin) throw new Error('MongoDB User for admin@microdo.com not found');

  const realHash = mongoAdmin.password;
  if (!isValidBcrypt(realHash)) {
    throw new Error('MongoDB hash for admin@microdo.com failed bcrypt format check — aborting');
  }

  // Pre-check to decide whether to write passwordHash in update block.
  // upsert is atomic — this pre-read is only used to produce accurate log output.
  const existing = await prisma.profile.findUnique({
    where:  { mongoId: MONGO_ID.admin },
    select: { passwordHash: true },
  });

  const shouldWriteHash = !existing || !isValidBcrypt(existing.passwordHash);

  await prisma.profile.upsert({
    where:  { mongoId: MONGO_ID.admin },
    create: {
      email:        'admin@microdo.com',
      name:         'Super Admin',
      passwordHash: realHash,
      role:         'ADMIN',
      status:       'ACTIVE',
      mongoId:      MONGO_ID.admin,
    },
    update: {
      role:   'ADMIN',
      status: 'ACTIVE',
      // Only overwrite passwordHash when the stored value is missing or invalid.
      // This preserves a valid bcrypt hash if the script is re-run.
      ...(shouldWriteHash ? { passwordHash: realHash } : {}),
    },
  });

  if (existing) {
    console.log(
      `  → Profile already existed. Updated role/status. ` +
      `${shouldWriteHash ? 'Wrote new hash.' : 'Preserved existing valid hash.'}`,
    );
  } else {
    console.log('  → Created new Prisma Profile for admin@microdo.com.');
  }
}

// ─── Operation 3: Read-only verify for bttu2002@gmail.com ─────────────────────

async function verifyBttu2002(): Promise<void> {
  console.log('\n[Op 3] bttu2002@gmail.com — read-only verify (no writes)...');

  const profile = await prisma.profile.findUnique({
    where:  { email: 'bttu2002@gmail.com' },
    select: { email: true, mongoId: true, passwordHash: true, role: true, status: true },
  });

  if (!profile) {
    throw new Error('Prisma Profile for bttu2002@gmail.com not found — unexpected state');
  }
  if (!isValidBcrypt(profile.passwordHash)) {
    throw new Error('bttu2002@gmail.com has invalid passwordHash in Prisma — unexpected state');
  }

  console.log('  → Profile OK. No changes needed.');
}

// ─── Verification block ───────────────────────────────────────────────────────

async function runVerification(): Promise<boolean> {
  console.log('\n');
  console.log('════════════════════════════════════════════════');
  console.log('  VERIFICATION');
  console.log('════════════════════════════════════════════════');

  let allPassed = true;

  // V1: Total Prisma profiles = 3
  const totalPrisma = await prisma.profile.count();
  if (totalPrisma === 3) {
    pass(`V1  Total Prisma profiles = 3`);
  } else {
    fail(`V1  Total Prisma profiles = ${totalPrisma} (expected 3)`);
    allPassed = false;
  }

  // V2: Zero profiles with @@MONGO_BRIDGE@@
  const bridgeCount = await prisma.profile.count({
    where: { passwordHash: MONGO_BRIDGE },
  });
  if (bridgeCount === 0) {
    pass(`V2  Zero profiles have passwordHash = '@@MONGO_BRIDGE@@'`);
  } else {
    fail(`V2  ${bridgeCount} profile(s) still have '@@MONGO_BRIDGE@@' — sync incomplete`);
    allPassed = false;
  }

  // Load both sides for cross-reference checks
  const prismaProfiles = await prisma.profile.findMany({
    select: { email: true, mongoId: true, passwordHash: true, role: true, status: true },
  });

  const mongoUsers = await User.find({}).lean() as Array<{ _id: mongoose.Types.ObjectId; email: string }>;
  const mongoIdSet     = new Set(mongoUsers.map(u => u._id.toString()));
  const prismaMongoIds = new Set(
    prismaProfiles.filter(p => p.mongoId).map(p => p.mongoId as string),
  );

  // V3: Every MongoDB user has a matching Prisma profile (by mongoId)
  let v3Pass = true;
  for (const mu of mongoUsers) {
    const mId = mu._id.toString();
    if (!prismaMongoIds.has(mId)) {
      fail(`V3  MongoDB user ${mu.email} (${mId}) has no matching Prisma profile`);
      v3Pass = false;
      allPassed = false;
    }
  }
  if (v3Pass) pass(`V3  Every MongoDB user has a matching Prisma profile by mongoId`);

  // V4: Every Prisma profile with a mongoId maps back to an existing MongoDB user
  let v4Pass = true;
  for (const p of prismaProfiles) {
    if (p.mongoId && !mongoIdSet.has(p.mongoId)) {
      fail(`V4  Orphan Prisma profile ${p.email} (mongoId: ${p.mongoId}) — no MongoDB user found`);
      v4Pass = false;
      allPassed = false;
    }
  }
  if (v4Pass) pass(`V4  No orphan Prisma profiles — all mongoIds resolve to MongoDB users`);

  // V5: All passwordHashes match bcrypt format /^$2[aby]$\d{2}$/
  let v5Pass = true;
  for (const p of prismaProfiles) {
    if (!isValidBcrypt(p.passwordHash)) {
      fail(`V5  ${p.email} has invalid passwordHash: "${p.passwordHash.slice(0, 20)}..."`);
      v5Pass = false;
      allPassed = false;
    }
  }
  if (v5Pass) {
    pass(`V5  All ${prismaProfiles.length} passwordHashes match bcrypt format /^\\$2[aby]\\$\\d{2}\\$/`);
  }

  // V6: admin@microdo.com has role=ADMIN, status=ACTIVE
  const adminProfile = prismaProfiles.find(p => p.email === 'admin@microdo.com');
  if (adminProfile?.role === 'ADMIN' && adminProfile?.status === 'ACTIVE') {
    pass(`V6  admin@microdo.com: role=ADMIN, status=ACTIVE`);
  } else {
    fail(
      `V6  admin@microdo.com: role=${adminProfile?.role ?? 'MISSING'}, ` +
      `status=${adminProfile?.status ?? 'MISSING'} (expected ADMIN / ACTIVE)`,
    );
    allPassed = false;
  }

  // V7: MongoDB users count unchanged = 3
  const mongoCount = await User.countDocuments();
  if (mongoCount === 3) {
    pass(`V7  MongoDB users count = 3 (unchanged — no MongoDB writes performed)`);
  } else {
    fail(`V7  MongoDB users count = ${mongoCount} (expected 3)`);
    allPassed = false;
  }

  console.log('════════════════════════════════════════════════');

  return allPassed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  MicroDo Phase 4.1b — User/Profile Sync');
  console.log('════════════════════════════════════════════════');
  console.log('');
  console.log('  ⚠️  IMPORTANT: Take a DB snapshot BEFORE running');
  console.log('     this script if rollback capability is required.');
  console.log('     After a successful sync, @@MONGO_BRIDGE@@ must');
  console.log('     never reappear. Rollback requires a DB restore,');
  console.log('     NOT a manual re-insert of placeholder values.');
  console.log('');

  await connectDB();
  console.log('[MongoDB] Connected.');

  // ─── Sync operations ────────────────────────────────────────────────────────
  await syncTestUser();
  await upsertAdminProfile();
  await verifyBttu2002();

  // ─── Verification ───────────────────────────────────────────────────────────
  const passed = await runVerification();

  // ─── Disconnect ─────────────────────────────────────────────────────────────
  await prisma.$disconnect();
  await mongoose.disconnect();

  if (!passed) {
    console.error('\n❌  Verification FAILED — one or more checks did not pass.');
    console.error('    Do NOT proceed to Phase 4.2 until all checks pass.');
    process.exit(1);
  }

  console.log('\n✅  Phase 4.1b sync complete. All verification checks passed.');
  console.log('    Gate conditions met — Phase 4.2 may now be authorized by you.');
  process.exit(0);
}

run().catch(async (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n💥 SYNC FATAL ERROR: ${msg}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  await prisma.$disconnect().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
