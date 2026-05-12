import { Department, Profile } from '@prisma/client';
import { PrismaDepartmentRepository } from '../repositories/prisma/departmentRepository';
import { PrismaProfileRepository } from '../repositories/prisma/profileRepository';
import {
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentWithMembers,
} from '../repositories/interfaces';

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
 * Assign a user to a department.
 * Accepts Prisma Profile UUID as canonical identifier.
 */
export const assignUserToDepartment = async (
  prismaId: string,
  departmentId: string
): Promise<Profile> => {
  const department = await departmentRepo.findById(departmentId);
  if (!department) {
    throw new ServiceError('Department not found', 404);
  }

  const profile = await profileRepo.findById(prismaId);
  if (!profile) {
    throw new ServiceError('User not found', 404);
  }

  if (profile.departmentId === departmentId) {
    throw new ServiceError('User is already assigned to this department', 409);
  }

  return profileRepo.update(profile.id, { departmentId });
};

/**
 * Remove a user from their department.
 * Accepts Prisma Profile UUID as canonical identifier.
 */
export const removeUserFromDepartment = async (
  prismaId: string
): Promise<Profile> => {
  const profile = await profileRepo.findById(prismaId);
  if (!profile) {
    throw new ServiceError('User profile not found', 404);
  }

  if (!profile.departmentId) {
    throw new ServiceError('User is not assigned to any department', 400);
  }

  return profileRepo.update(profile.id, { departmentId: null });
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
