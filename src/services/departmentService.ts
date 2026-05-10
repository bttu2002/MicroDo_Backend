import { Department, Profile } from '@prisma/client';
import { PrismaDepartmentRepository } from '../repositories/prisma/departmentRepository';
import { PrismaProfileRepository } from '../repositories/prisma/profileRepository';
import {
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentWithMembers,
} from '../repositories/interfaces';
import User from '../models/User'; // ← MongoDB User model (source of truth during Phase 2)
import prisma from '../config/prisma'; // ← Direct Prisma client for mongoId bridge linking

// ─── Repository Instances ────────────────────────────────────

const departmentRepo = new PrismaDepartmentRepository();
const profileRepo = new PrismaProfileRepository();

// ─── Service Functions ───────────────────────────────────────

/**
 * Create a new department.
 * Validates that department name is unique.
 */
export const createDepartment = async (
  data: CreateDepartmentData
): Promise<Department> => {
  // Validate: name must not be empty
  if (!data.name || data.name.trim().length === 0) {
    throw new ServiceError('Department name is required', 400);
  }

  const trimmedName = data.name.trim();

  // Validate: name must be unique
  const existing = await departmentRepo.findByName(trimmedName);
  if (existing) {
    throw new ServiceError(
      `Department with name "${trimmedName}" already exists`,
      409
    );
  }

  const createData: CreateDepartmentData = { name: trimmedName };
  if (data.description && data.description.trim().length > 0) {
    createData.description = data.description.trim();
  }

  return departmentRepo.create(createData);
};

/**
 * Get all departments with member and task counts.
 */
export const getDepartments = async (): Promise<DepartmentWithMembers[]> => {
  return departmentRepo.findAllWithCount();
};

/**
 * Get a single department by ID, including its members.
 */
export const getDepartmentById = async (
  id: string
): Promise<DepartmentWithMembers> => {
  const department = await departmentRepo.findWithMembers(id);
  if (!department) {
    throw new ServiceError('Department not found', 404);
  }
  return department;
};

/**
 * Update department details (name, description).
 * Validates uniqueness if name is changed.
 */
export const updateDepartment = async (
  id: string,
  data: UpdateDepartmentData
): Promise<Department> => {
  // Check department exists
  const existing = await departmentRepo.findById(id);
  if (!existing) {
    throw new ServiceError('Department not found', 404);
  }

  // If changing name, validate uniqueness
  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (trimmedName.length === 0) {
      throw new ServiceError('Department name cannot be empty', 400);
    }

    const duplicate = await departmentRepo.findByName(trimmedName);
    if (duplicate && duplicate.id !== id) {
      throw new ServiceError(
        `Department with name "${trimmedName}" already exists`,
        409
      );
    }

    data.name = trimmedName;
  }

  if (data.description !== undefined) {
    data.description = data.description.trim();
  }

  return departmentRepo.update(id, data);
};

/**
 * Delete a department.
 *
 * Option C behavior (approved by user):
 * - Default: block deletion if department still has members
 * - With force=true: set departmentId=null on all members, then delete
 */
export const deleteDepartment = async (
  id: string,
  force: boolean = false
): Promise<Department> => {
  // Check department exists
  const existing = await departmentRepo.findById(id);
  if (!existing) {
    throw new ServiceError('Department not found', 404);
  }

  // Check member count
  const memberCount = await departmentRepo.getMemberCount(id);

  if (memberCount > 0 && !force) {
    throw new ServiceError(
      `Cannot delete department: ${memberCount} member(s) still assigned. ` +
        `Remove all members first, or use ?force=true to force deletion.`,
      409
    );
  }

  // If force mode and has members, clear all members first
  if (memberCount > 0 && force) {
    await departmentRepo.clearAllMembers(id);
  }

  return departmentRepo.delete(id);
};

/**
 * Assign a user to a department using the mongoId bridge pattern.
 *
 * Safe UPSERT behavior (approved by user):
 * 1. Prioritize mongoId lookup → find existing Prisma Profile by mongoId
 * 2. Fallback to email lookup → find existing Prisma Profile by email
 * 3. If no Profile found → create new Profile from MongoDB User data
 * 4. Update Profile's departmentId
 *
 * MongoDB User remains source of truth during Phase 2.
 */
export const assignUserToDepartment = async (
  mongoUserId: string,
  departmentId: string
): Promise<Profile> => {
  // 1. Validate department exists
  const department = await departmentRepo.findById(departmentId);
  if (!department) {
    throw new ServiceError('Department not found', 404);
  }

  // 2. Find MongoDB User (source of truth)
  const mongoUser = await User.findById(mongoUserId).select(
    'email name avatar role status'
  );
  if (!mongoUser) {
    throw new ServiceError('User not found in database', 404);
  }

  // 3. Safe UPSERT: find or create Prisma Profile
  let profile = await findOrCreateProfile(mongoUserId, mongoUser);

  // 4. Check if already in this department
  if (profile.departmentId === departmentId) {
    throw new ServiceError(
      'User is already assigned to this department',
      409
    );
  }

  // 5. Update department assignment
  profile = await profileRepo.update(profile.id, { departmentId });

  return profile;
};

/**
 * Remove a user from their department.
 * Uses mongoId bridge to find the Prisma Profile.
 */
export const removeUserFromDepartment = async (
  mongoUserId: string
): Promise<Profile> => {
  // Find Prisma Profile by mongoId
  const profile = await profileRepo.findByMongoId(mongoUserId);
  if (!profile) {
    throw new ServiceError(
      'User profile not found. User may not have been assigned to any department yet.',
      404
    );
  }

  if (!profile.departmentId) {
    throw new ServiceError(
      'User is not assigned to any department',
      400
    );
  }

  return profileRepo.update(profile.id, { departmentId: null });
};

// ─── Internal Helpers ────────────────────────────────────────

/**
 * MongoId Bridge — Safe UPSERT pattern
 *
 * Finds existing Prisma Profile or creates one from MongoDB User data.
 * Lookup priority: mongoId → email → create new
 */
const findOrCreateProfile = async (
  mongoUserId: string,
  mongoUser: any
): Promise<Profile> => {
  // Priority 1: Find by mongoId
  let profile = await profileRepo.findByMongoId(mongoUserId);
  if (profile) {
    return profile;
  }

  // Priority 2: Find by email (handles case where Profile exists but mongoId wasn't set)
  profile = await profileRepo.findByEmail(mongoUser.email);
  if (profile) {
    // Link the mongoId to existing profile for future lookups
    if (!profile.mongoId) {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: { mongoId: mongoUserId },
      });
    }
    return profile;
  }

  // Priority 3: Create new Profile from MongoDB User data
  profile = await profileRepo.create({
    email: mongoUser.email,
    name: mongoUser.name || undefined,
    avatar: mongoUser.avatar || undefined,
    passwordHash: '@@MONGO_BRIDGE@@', // Placeholder — auth still uses MongoDB
    role: mapMongoRole(mongoUser.role),
    mongoId: mongoUserId,
  });

  return profile;
};

/**
 * Maps MongoDB role values to Prisma Role enum.
 * During Phase 2, only USER and ADMIN exist in MongoDB.
 */
const mapMongoRole = (
  mongoRole: string
): 'USER' | 'ADMIN' | 'DEPT_MANAGER' | 'DEPT_MEMBER' => {
  switch (mongoRole) {
    case 'ADMIN':
      return 'ADMIN';
    case 'USER':
    default:
      return 'USER';
  }
};

// ─── Service Error Class ─────────────────────────────────────

export class ServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
  }
}
