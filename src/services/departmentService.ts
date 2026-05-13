import { Department } from '@prisma/client';
import { PrismaDepartmentRepository } from '../repositories/prisma/departmentRepository';
import { PrismaMembershipRepository } from '../repositories/prisma/membershipRepository';
import {
  CreateDepartmentData,
  UpdateDepartmentData,
  DepartmentWithMembers,
  PaginatedDepartmentsResult,
} from '../repositories/interfaces';

const departmentRepo = new PrismaDepartmentRepository();
const membershipRepo = new PrismaMembershipRepository();

// ─── Department CRUD ──────────────────────────────────────────

export const createDepartment = async (data: CreateDepartmentData): Promise<Department> => {
  if (!data.name || data.name.trim().length === 0) {
    throw new ServiceError('Department name is required', 400);
  }

  const trimmedName = data.name.trim();

  const existing = await departmentRepo.findByName(trimmedName);
  if (existing) {
    throw new ServiceError(`Department with name "${trimmedName}" already exists`, 409);
  }

  const createData: CreateDepartmentData = { name: trimmedName };
  if (data.description && data.description.trim().length > 0) {
    createData.description = data.description.trim();
  }

  return departmentRepo.create(createData);
};

export const getDepartments = async (
  page: number,
  limit: number
): Promise<PaginatedDepartmentsResult> => {
  return departmentRepo.findAllWithCount(page, limit);
};

export const getDepartmentById = async (id: string): Promise<DepartmentWithMembers> => {
  const department = await departmentRepo.findWithMembers(id);
  if (!department) throw new ServiceError('Department not found', 404);
  return department;
};

export const updateDepartment = async (
  id: string,
  data: UpdateDepartmentData
): Promise<Department> => {
  const existing = await departmentRepo.findById(id);
  if (!existing) throw new ServiceError('Department not found', 404);

  if (data.name !== undefined) {
    const trimmedName = data.name.trim();
    if (trimmedName.length === 0) throw new ServiceError('Department name cannot be empty', 400);

    const duplicate = await departmentRepo.findByName(trimmedName);
    if (duplicate && duplicate.id !== id) {
      throw new ServiceError(`Department with name "${trimmedName}" already exists`, 409);
    }
    data.name = trimmedName;
  }

  if (data.description !== undefined) {
    data.description = data.description.trim();
  }

  return departmentRepo.update(id, data);
};

export const deleteDepartment = async (
  id: string,
  force: boolean = false
): Promise<Department> => {
  const existing = await departmentRepo.findById(id);
  if (!existing) throw new ServiceError('Department not found', 404);

  const memberCount = await membershipRepo.countActive(id);

  if (memberCount > 0 && !force) {
    throw new ServiceError(
      `Cannot delete department: ${memberCount} active member(s) still assigned. ` +
        `Remove all members first, or use ?force=true to force deletion.`,
      409
    );
  }

  // With force=true: delete department — DepartmentMember cascade handles cleanup
  return departmentRepo.delete(id);
};

// ─── Service Error ────────────────────────────────────────────

export class ServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
  }
}
