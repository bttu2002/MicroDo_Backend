import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Prisma } from '@prisma/client';
import Task from '../../models/Task';
import prisma from '../../config/prisma';
import connectDB from '../../config/database';

dotenv.config();

// ─── Configuration ────────────────────────────────────────────────────────────

const BATCH_SIZE  = 200;
const IS_DRY_RUN  = process.argv.includes('--dry-run');

const VALID_STATUSES   = new Set(['todo', 'doing', 'done']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrphanRecord {
  mongoId:     string;
  mongoUserId: string;
}

interface InvalidRecord {
  mongoId: string;
  reason:  string;
}

interface MigrationStats {
  totalScanned:      number;
  totalMigrated:     number;
  duplicatesSkipped: number;
  orphans:           OrphanRecord[];
  invalids:          InvalidRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Loads ALL Prisma profiles into a Map<mongoId, profileId> in a single query.
 * One round-trip, then O(1) lookup per task during transform.
 */
async function preloadProfileMap(): Promise<Map<string, string>> {
  console.log('[Profile Map] Loading all profiles from PostgreSQL...');

  const profiles = await prisma.profile.findMany({
    select: { id: true, mongoId: true },
  });

  const map = new Map<string, string>();
  for (const p of profiles) {
    if (p.mongoId) map.set(p.mongoId, p.id);
  }

  console.log(`[Profile Map] ${map.size} profile(s) bridged (mongoId → prismaId).\n`);
  return map;
}

/**
 * Transforms a single Mongoose Task document into a Prisma.TaskCreateManyInput.
 *
 * Uses Prisma.TaskCreateManyInput (NOT CreateTaskData) because:
 *  - CreateTaskData.deadline is Date | undefined (no null)
 *  - Prisma Task.deadline is DateTime?  → must support null
 *
 * Returns null if the task must be skipped (orphan / invalid data).
 * Side-effects: pushes to stats.orphans or stats.invalids accordingly.
 */
function transformTask(
  doc:        mongoose.Document & Record<string, any>,
  profileMap: Map<string, string>,
  stats:      MigrationStats,
): Prisma.TaskCreateManyInput | null {
  const mongoId     = (doc._id as mongoose.Types.ObjectId).toString();
  const mongoUserId = doc.userId?.toString() ?? '';

  // 1. Resolve Profile FK via preloaded map
  if (!mongoUserId) {
    stats.invalids.push({ mongoId, reason: 'Missing userId field' });
    return null;
  }
  const profileId = profileMap.get(mongoUserId);
  if (!profileId) {
    stats.orphans.push({ mongoId, mongoUserId });
    return null;
  }

  // 2. Normalize + validate status
  const rawStatus = doc.status?.toString() ?? '';
  const status    = rawStatus.toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    stats.invalids.push({ mongoId, reason: `Invalid status: '${rawStatus}'` });
    return null;
  }

  // 3. Normalize + validate priority
  const rawPriority = doc.priority?.toString() ?? '';
  const priority    = rawPriority.toLowerCase();
  if (!VALID_PRIORITIES.has(priority)) {
    stats.invalids.push({ mongoId, reason: `Invalid priority: '${rawPriority}'` });
    return null;
  }

  // 4. Filter tags — remove empty / whitespace-only strings
  const tags: string[] = Array.isArray(doc.tags)
    ? doc.tags.filter((t: unknown) => typeof t === 'string' && t.trim() !== '')
    : [];

  // 5. Validate deadline — skip task on corrupt Date
  let deadline: Date | null = null;
  if (doc.deadline != null) {
    const d = new Date(doc.deadline);
    if (isNaN(d.getTime())) {
      stats.invalids.push({ mongoId, reason: `Invalid deadline: '${doc.deadline}'` });
      return null;
    }
    deadline = d;
  }

  // 6. Build payload — explicit createdAt/updatedAt preserves Mongo timestamps
  return {
    mongoId,
    title:       doc.title,
    description: doc.description ?? '',
    status:      status   as 'todo' | 'doing' | 'done',
    priority:    priority as 'low'  | 'medium' | 'high',
    tags,
    deadline,
    profileId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Flushes one batch to PostgreSQL (or prints dry-run log).
 *
 * On batch DB failure: logs the failing batch's mongoIds then re-throws,
 * aborting the entire ETL run (per error policy).
 */
async function flushBatch(
  batch:    Prisma.TaskCreateManyInput[],
  batchNum: number,
  stats:    MigrationStats,
): Promise<void> {
  const t0 = Date.now();

  if (IS_DRY_RUN) {
    stats.totalMigrated += batch.length;
    console.log(
      `[Batch ${batchNum}] DRY-RUN — would insert ${batch.length} record(s)` +
      `  | scanned: ${stats.totalScanned}` +
      `  | orphans: ${stats.orphans.length}` +
      `  | invalid: ${stats.invalids.length}` +
      `  | ${Date.now() - t0}ms`,
    );
    return;
  }

  let result: Prisma.BatchPayload;
  try {
    result = await prisma.task.createMany({
      data:           batch,
      skipDuplicates: true,   // idempotent: existing mongoId rows are silently skipped
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n💥 BATCH ${batchNum} DB ERROR: ${msg}`);
    console.error(`   Batch size: ${batch.length} records`);
    console.error('   First 5 mongoIds in failing batch:');
    batch.slice(0, 5).forEach(r => console.error(`     - ${r.mongoId}`));
    throw err;  // abort ETL
  }

  const inserted = result.count;
  const skipped  = batch.length - inserted;
  stats.totalMigrated     += inserted;
  stats.duplicatesSkipped += skipped;

  console.log(
    `[Batch ${batchNum}] ✅  inserted: ${inserted}` +
    `  | duplicates skipped: ${skipped}` +
    `  | scanned: ${stats.totalScanned}` +
    `  | orphans: ${stats.orphans.length}` +
    `  | ${Date.now() - t0}ms`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const globalStart = Date.now();

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log('  MicroDo ETL  ─  MongoDB Tasks → PostgreSQL');
  console.log(`  Mode  : ${IS_DRY_RUN ? '🔍  DRY-RUN  (zero writes to DB)' : '🚀  LIVE MIGRATION'}`);
  console.log(`  Batch : ${BATCH_SIZE} records`);
  console.log('════════════════════════════════════════════════');
  console.log('');

  await connectDB();
  console.log('[MongoDB] Connected.\n');

  const profileMap      = await preloadProfileMap();
  const totalInMongo    = await Task.countDocuments();

  console.log(`[MongoDB] Tasks to process: ${totalInMongo}\n`);

  if (totalInMongo === 0) {
    console.log('[ETL] No tasks found in MongoDB. Nothing to migrate.');
    await prisma.$disconnect();
    process.exit(0);
  }

  const stats: MigrationStats = {
    totalScanned:      0,
    totalMigrated:     0,
    duplicatesSkipped: 0,
    orphans:           [],
    invalids:          [],
  };

  let batch:    Prisma.TaskCreateManyInput[] = [];
  let batchNum  = 0;

  console.log('[ETL] Streaming cursor from MongoDB...\n');

  const cursor = Task.find().cursor();

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    stats.totalScanned++;

    const record = transformTask(doc as any, profileMap, stats);
    if (record) batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      await flushBatch(batch, batchNum, stats);
      batch = [];
    }
  }

  // Flush the final partial batch (if any)
  if (batch.length > 0) {
    batchNum++;
    await flushBatch(batch, batchNum, stats);
  }

  // ─── Final Summary ──────────────────────────────────────────────────────────
  const elapsed   = ((Date.now() - globalStart) / 1000).toFixed(2);
  const modeLabel = IS_DRY_RUN ? 'DRY-RUN SUMMARY' : 'MIGRATION SUMMARY';

  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log(`  ${modeLabel}`);
  console.log('════════════════════════════════════════════════');
  console.log(`  Total scanned         : ${stats.totalScanned}`);
  console.log(`  ${IS_DRY_RUN ? 'Would insert          ' : 'Total migrated        '} : ${stats.totalMigrated}`);
  if (!IS_DRY_RUN) {
    console.log(`  Duplicates skipped    : ${stats.duplicatesSkipped}`);
  }
  console.log(`  Orphaned tasks        : ${stats.orphans.length}`);
  console.log(`  Invalid tasks         : ${stats.invalids.length}`);
  console.log(`  Duration              : ${elapsed}s`);
  console.log('════════════════════════════════════════════════');

  // Orphan report
  if (stats.orphans.length > 0) {
    console.log('');
    console.log(`⚠️   ORPHANED TASKS (${stats.orphans.length}) — no matching Prisma Profile:`);
    stats.orphans.forEach(o =>
      console.log(`    - Task ${o.mongoId}  ←  userId: ${o.mongoUserId}`),
    );
    console.log('    → Fix: run fixOrphanedProfile.ts for each userId, then re-run ETL.');
  }

  // Invalid report
  if (stats.invalids.length > 0) {
    console.log('');
    console.log(`❌   INVALID TASKS (${stats.invalids.length}) — skipped (manual review required):`);
    stats.invalids.forEach(i => console.log(`    - ${i.mongoId}: ${i.reason}`));
  }

  // Clean result
  if (stats.orphans.length === 0 && stats.invalids.length === 0) {
    console.log('\n✅  All tasks processed cleanly — no orphans, no validation errors.');
  }

  if (IS_DRY_RUN) {
    console.log('\n⚠️   DRY-RUN complete. Zero writes to PostgreSQL.');
    console.log('    To execute: npm run migrate:tasks');
  }

  await prisma.$disconnect();

  // Exit 1 if any orphans or invalids so CI/CD can detect incomplete migration
  process.exit(stats.orphans.length > 0 || stats.invalids.length > 0 ? 1 : 0);
}

run().catch(async (err: unknown) => {
  console.error('\n💥 ETL FATAL ERROR:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
