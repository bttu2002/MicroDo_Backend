import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from '../models/Task';
import User from '../models/User';
import connectDB from '../config/database';

dotenv.config();

const auditTasks = async () => {
  console.log('🔍 Starting MongoDB Task Data Audit...\n');
  
  await connectDB();

  const totalTasks = await Task.countDocuments();
  console.log(`📊 Total tasks in database: ${totalTasks}`);

  if (totalTasks === 0) {
    console.log('✅ No tasks found. Safe to migrate.');
    process.exit(0);
  }

  let warnings = 0;
  let blockers = 0;

  // Trackers
  const invalidDeadlines: string[] = [];
  const malformedTags: string[] = [];
  const invalidEnums: any[] = [];
  const missingRequired: string[] = [];
  const orphanedUsers: string[] = [];
  const inconsistentCasing: any[] = [];

  const validStatuses = ['todo', 'doing', 'done'];
  const validPriorities = ['low', 'medium', 'high'];

  // Fetch all tasks for auditing
  const cursor = Task.find().cursor();

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const id = doc._id.toString();

    // 1. Missing Required
    if (!doc.title || !doc.userId) {
      missingRequired.push(id);
      blockers++;
    }

    // 2. Invalid Enums & Casing
    if (!validStatuses.includes(doc.status)) {
      if (doc.status && validStatuses.includes(doc.status.toLowerCase())) {
        inconsistentCasing.push({ id, field: 'status', value: doc.status });
        warnings++;
      } else {
        invalidEnums.push({ id, field: 'status', value: doc.status });
        blockers++;
      }
    }

    if (!validPriorities.includes(doc.priority)) {
      if (doc.priority && validPriorities.includes(doc.priority.toLowerCase())) {
        inconsistentCasing.push({ id, field: 'priority', value: doc.priority });
        warnings++;
      } else {
        invalidEnums.push({ id, field: 'priority', value: doc.priority });
        blockers++;
      }
    }

    // 3. Invalid deadlines
    if (doc.deadline) {
      const d = new Date(doc.deadline);
      if (isNaN(d.getTime())) {
        invalidDeadlines.push(id);
        blockers++;
      }
    }

    // 4. Malformed tags
    if (doc.tags && Array.isArray(doc.tags)) {
      const hasMalformed = doc.tags.some((t: any) => typeof t !== 'string' || t.trim() === '');
      if (hasMalformed) {
        malformedTags.push(id);
        warnings++;
      }
    } else if (doc.tags != null && !Array.isArray(doc.tags)) {
      malformedTags.push(id);
      blockers++;
    }

    // 5. Orphaned userIds
    if (doc.userId) {
      const userExists = await User.findById(doc.userId).lean();
      if (!userExists) {
        orphanedUsers.push(id);
        blockers++; // Prisma relation to Profile will fail
      }
    }
  }

  console.log('\n--- 📝 AUDIT REPORT ---');
  console.log(`Missing required fields: ${missingRequired.length}`);
  console.log(`Invalid deadlines: ${invalidDeadlines.length}`);
  console.log(`Invalid enum values: ${invalidEnums.length}`);
  console.log(`Inconsistent enum casing: ${inconsistentCasing.length}`);
  console.log(`Malformed tags: ${malformedTags.length}`);
  console.log(`Orphaned tasks (missing user): ${orphanedUsers.length}`);

  console.log('\n--- 🛑 SUMMARY ---');
  console.log(`Total Warnings: ${warnings}`);
  console.log(`Total Blockers: ${blockers}`);

  if (blockers > 0) {
    console.log('\n❌ FAILED: Data cleanup is REQUIRED before Phase 3 migration.');
  } else {
    console.log('\n✅ PASSED: Task data is clean and ready for migration.');
  }

  process.exit(0);
};

auditTasks().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
