import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from '../../models/Task';
import prisma from '../../config/prisma';
import connectDB from '../../config/database';

dotenv.config();

/**
 * DRY-RUN ETL MIGRATION SCRIPT
 * This script calculates and validates the transformation from MongoDB Task
 * to PostgreSQL Prisma Task, explicitly testing the mongoId Bridge logic.
 * 
 * IMPORTANT: This DOES NOT modify the PostgreSQL database.
 */
const runDryRun = async () => {
  console.log('🚀 Starting ETL Dry-Run: MongoDB -> Prisma PostgreSQL\n');
  
  await connectDB();

  const totalTasks = await Task.countDocuments();
  console.log(`📊 Tasks to process: ${totalTasks}\n`);

  if (totalTasks === 0) {
    console.log('✅ No tasks to migrate.');
    process.exit(0);
  }

  let mappedSuccessfully = 0;
  let failedMappings = 0;
  
  // Track failures for reporting
  const missingProfiles: string[] = [];
  const validTransformations: any[] = [];

  // Cache mongoUserId -> prismaProfileId to avoid redundant queries
  const userProfileCache = new Map<string, string | null>();

  const cursor = Task.find().cursor();

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const mongoUserId = doc.userId.toString();
    
    // 1. Resolve Profile ID using the MongoId Bridge
    let prismaProfileId = userProfileCache.get(mongoUserId);
    
    if (prismaProfileId === undefined) {
      // Lookup in Postgres via Profile.mongoId (created during Phase 2)
      const profile = await prisma.profile.findUnique({
        where: { mongoId: mongoUserId },
        select: { id: true }
      });

      if (profile) {
        prismaProfileId = profile.id;
        userProfileCache.set(mongoUserId, profile.id);
      } else {
        prismaProfileId = null;
        userProfileCache.set(mongoUserId, null);
      }
    }

    if (!prismaProfileId) {
      failedMappings++;
      if (!missingProfiles.includes(mongoUserId)) {
        missingProfiles.push(mongoUserId);
      }
      continue;
    }

    // 2. Prepare transformation payload (Dry-Run only, NOT inserting)
    const transformedData = {
      mongoId: doc._id.toString(), // Preserve original MongoId for frontend backward compatibility
      title: doc.title,
      description: doc.description || '',
      status: doc.status.toLowerCase(), // Normalizing Enums
      priority: doc.priority.toLowerCase(), // Normalizing Enums
      tags: doc.tags || [],
      deadline: doc.deadline || null,
      profileId: prismaProfileId, // Mapped relationship!
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    validTransformations.push(transformedData);
    mappedSuccessfully++;
  }

  console.log('--- 🛑 ETL DRY-RUN SUMMARY ---');
  console.log(`✅ Successfully mapped records: ${mappedSuccessfully}/${totalTasks}`);
  console.log(`❌ Failed mappings (orphaned): ${failedMappings}`);
  
  if (missingProfiles.length > 0) {
    console.log('\n⚠️ WARNING: Some Mongo users do not have a matching Prisma Profile.');
    console.log(`Unmapped Mongo User IDs (${missingProfiles.length}):`, missingProfiles);
    console.log('👉 ACTION REQUIRED: You MUST ensure all Users have synced Profiles before Phase 3.');
  }

  if (validTransformations.length > 0) {
    console.log('\n🔍 Sample Transformed Payload (What will be inserted into Postgres):');
    console.log(JSON.stringify(validTransformations[0], null, 2));
  }

  console.log('\n⚠️ NOTE: This was a DRY-RUN. No data was actually inserted into PostgreSQL.');

  process.exit(missingProfiles.length > 0 ? 1 : 0);
};

runDryRun().catch((err) => {
  console.error('Dry-Run failed:', err);
  process.exit(1);
});
