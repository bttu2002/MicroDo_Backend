import { z } from 'zod';
import { DepartmentMemberRole } from '@prisma/client';

export const createDepartmentSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional(),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name:        z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role:   z.nativeEnum(DepartmentMemberRole).optional(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const changeMemberRoleSchema = z.object({
  role: z.nativeEnum(DepartmentMemberRole, { message: 'role is required' }),
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, 'newOwnerId is required'),
});
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export const assignUserToDepartmentSchema = z.object({
  departmentId: z.string().min(1, 'departmentId is required'),
  role:         z.nativeEnum(DepartmentMemberRole).optional(),
});
export type AssignUserToDepartmentInput = z.infer<typeof assignUserToDepartmentSchema>;

export const removeUserFromDepartmentSchema = z.object({
  departmentId: z.string().min(1, 'departmentId is required'),
});
export type RemoveUserFromDepartmentInput = z.infer<typeof removeUserFromDepartmentSchema>;

export const deleteDepartmentQuerySchema = z.object({
  force: z.string().optional().transform(v => v === 'true'),
});
export type DeleteDepartmentQuery = z.infer<typeof deleteDepartmentQuerySchema>;
