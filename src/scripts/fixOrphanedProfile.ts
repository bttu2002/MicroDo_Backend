import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import prisma from '../config/prisma';
import connectDB from '../config/database';

dotenv.config();

const TARGET_MONGO_ID = '69c3bfacf1e800e4d45925e1';

const fixOrphanedProfile = async () => {
  console.log(`🚀 Starting Orphaned Profile Fix for Mongo ID: ${TARGET_MONGO_ID}\n`);
  
  await connectDB();

  // STEP 1: Locate the MongoDB User document
  const mongoUser = await User.findById(TARGET_MONGO_ID).lean();
  
  if (!mongoUser) {
    console.error('❌ ERROR: Mongo User not found in database. The ID might be invalid or deleted.');
    process.exit(1);
  }

  console.log('✅ Found Mongo User:');
  console.log(`   - ID: ${mongoUser._id}`);
  console.log(`   - Email: ${mongoUser.email}`);
  console.log(`   - Role: ${mongoUser.role}\n`);

  // STEP 2: Verify whether a matching Prisma Profile already exists
  let prismaProfile = await prisma.profile.findUnique({
    where: { mongoId: TARGET_MONGO_ID }
  });

  if (prismaProfile) {
    console.log('✅ Prisma Profile already exists and is correctly mapped by mongoId.');
    console.log(prismaProfile);
    process.exit(0);
  }

  console.log('⚠️ Prisma Profile not found by mongoId. Checking by email...');

  prismaProfile = await prisma.profile.findUnique({
    where: { email: mongoUser.email }
  });

  // STEP 3 & 4: Create or Patch Prisma Profile
  if (prismaProfile) {
    console.log('⚠️ Found existing Prisma Profile by email. Patching mongoId...');
    
    prismaProfile = await prisma.profile.update({
      where: { email: mongoUser.email },
      data: { mongoId: TARGET_MONGO_ID }
    });
    
    console.log('✅ Successfully patched mongoId onto existing Profile!');
  } else {
    console.log('⚠️ No existing Profile found by email. Creating a new Prisma Profile...');
    
    // Create new profile mapped to the mongoUser
    prismaProfile = await prisma.profile.create({
      data: {
        mongoId: TARGET_MONGO_ID,
        email: mongoUser.email,
        name: mongoUser.name || `User_${TARGET_MONGO_ID.substring(0, 6)}`,
        avatar: mongoUser.avatar || null,
        passwordHash: mongoUser.password, // Preserve hash to avoid auth breakage
        role: mongoUser.role as any,      // Trusting existing casing from previous enum normalizations
        status: mongoUser.status as any,
      }
    });

    console.log('✅ Successfully created new Prisma Profile!');
  }

  // STEP 5: Verify Final Integrity
  console.log('\n🔍 Verifying final integrity...');
  const verifyProfile = await prisma.profile.findUnique({
    where: { mongoId: TARGET_MONGO_ID }
  });

  if (verifyProfile && verifyProfile.email === mongoUser.email && verifyProfile.mongoId === TARGET_MONGO_ID) {
    console.log('✅ Integrity Check Passed!');
    console.log(`   - Prisma ID: ${verifyProfile.id}`);
    console.log(`   - Mongo ID: ${verifyProfile.mongoId}`);
    console.log(`   - Email: ${verifyProfile.email}`);
  } else {
    console.error('❌ ERROR: Final integrity check failed.');
    process.exit(1);
  }

  process.exit(0);
};

fixOrphanedProfile().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
