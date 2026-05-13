import { DepartmentMember, DepartmentMemberRole } from '@prisma/client';
import prisma from '../config/prisma';
import { PrismaMembershipRepository } from '../repositories/prisma/membershipRepository';
import { PrismaDepartmentRepository } from '../repositories/prisma/departmentRepository';
import { PrismaProfileRepository } from '../repositories/prisma/profileRepository';
import { PrismaActivityLogRepository } from '../repositories/prisma/activityLogRepository';
import { MemberWithProfile } from '../repositories/interfaces';
import { ServiceError } from './departmentService';

const membershipRepo = new PrismaMembershipRepository();
const departmentRepo = new PrismaDepartmentRepository();
const profileRepo = new PrismaProfileRepository();
const activityLogRepo = new PrismaActivityLogRepository();

// ─── Role Hierarchy ───────────────────────────────────────────

const ROLE_RANK: Record<DepartmentMemberRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

const canManage = (actor: DepartmentMemberRole, target: DepartmentMemberRole): boolean =>
  ROLE_RANK[actor] > ROLE_RANK[target];

// ─── Read ─────────────────────────────────────────────────────

export const listMembers = async (departmentId: string): Promise<MemberWithProfile[]> => {
  const dept = await departmentRepo.findById(departmentId);
  if (!dept) throw new ServiceError('Department not found', 404);
  return membershipRepo.findActiveMembersByDepartment(departmentId);
};

export const getMembership = async (
  userId: string,
  departmentId: string
): Promise<DepartmentMember | null> => {
  return membershipRepo.findByUserAndDepartment(userId, departmentId);
};

// ─── Add Member (direct, no invitation) ──────────────────────

export const addMember = async (
  actorId: string,
  departmentId: string,
  targetUserId: string,
  role: DepartmentMemberRole = 'MEMBER'
): Promise<DepartmentMember> => {
  const dept = await departmentRepo.findById(departmentId);
  if (!dept) throw new ServiceError('Department not found', 404);

  if (role === 'OWNER') {
    throw new ServiceError('Cannot assign OWNER role directly. Use transfer ownership.', 400);
  }

  const actorProfile = await profileRepo.findById(actorId);
  const isGlobalAdmin = actorProfile?.role === 'ADMIN';

  if (!isGlobalAdmin) {
    const actorMembership = await membershipRepo.findByUserAndDepartment(actorId, departmentId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      throw new ServiceError('You are not a member of this department', 403);
    }
    if (!['OWNER', 'ADMIN'].includes(actorMembership.role)) {
      throw new ServiceError('Only OWNER or ADMIN can add members', 403);
    }
    if (actorMembership.role === 'ADMIN' && role === 'ADMIN') {
      throw new ServiceError('ADMIN cannot assign ADMIN role', 403);
    }
  }

  const targetProfile = await profileRepo.findById(targetUserId);
  if (!targetProfile) throw new ServiceError('User not found', 404);

  const existing = await membershipRepo.findByUserAndDepartment(targetUserId, departmentId);
  if (existing) {
    if (existing.status === 'ACTIVE') {
      throw new ServiceError('User is already an active member of this department', 409);
    }
    const reactivated = await membershipRepo.update(existing.id, { role, status: 'ACTIVE' });
    void activityLogRepo.create({
      actorUserId: actorId,
      departmentId,
      entityType: 'membership',
      entityId: reactivated.id,
      action: 'member.added',
      metadata: { targetUserId, role },
    });
    return reactivated;
  }

  const membership = await membershipRepo.create({ userId: targetUserId, departmentId, role, invitedBy: actorId });
  void activityLogRepo.create({
    actorUserId: actorId,
    departmentId,
    entityType: 'membership',
    entityId: membership.id,
    action: 'member.added',
    metadata: { targetUserId, role },
  });
  return membership;
};

// ─── Admin-level Add (bypasses RBAC check) ───────────────────

export const adminAddMember = async (
  targetUserId: string,
  departmentId: string,
  role: DepartmentMemberRole = 'MEMBER',
  actorId?: string
): Promise<DepartmentMember> => {
  const dept = await departmentRepo.findById(departmentId);
  if (!dept) throw new ServiceError('Department not found', 404);

  const targetProfile = await profileRepo.findById(targetUserId);
  if (!targetProfile) throw new ServiceError('User not found', 404);

  if (role === 'OWNER') throw new ServiceError('Cannot assign OWNER via admin route. Use transfer ownership.', 400);

  const existing = await membershipRepo.findByUserAndDepartment(targetUserId, departmentId);
  if (existing) {
    if (existing.status === 'ACTIVE') {
      throw new ServiceError('User is already an active member of this department', 409);
    }
    return membershipRepo.update(existing.id, { role, status: 'ACTIVE' });
  }

  const createData = { userId: targetUserId, departmentId, role };
  if (actorId !== undefined) {
    return membershipRepo.create({ ...createData, invitedBy: actorId });
  }
  return membershipRepo.create(createData);
};

// ─── Remove Member ────────────────────────────────────────────

export const removeMember = async (
  actorId: string,
  departmentId: string,
  targetUserId: string
): Promise<void> => {
  const actorProfile = await profileRepo.findById(actorId);
  const isGlobalAdmin = actorProfile?.role === 'ADMIN';

  if (!isGlobalAdmin) {
    const actorMembership = await membershipRepo.findByUserAndDepartment(actorId, departmentId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      throw new ServiceError('You are not a member of this department', 403);
    }
    if (!['OWNER', 'ADMIN'].includes(actorMembership.role)) {
      throw new ServiceError('Only OWNER or ADMIN can remove members', 403);
    }
  }

  const targetMembership = await membershipRepo.findByUserAndDepartment(targetUserId, departmentId);
  if (!targetMembership || targetMembership.status !== 'ACTIVE') {
    throw new ServiceError('User is not an active member of this department', 404);
  }

  if (targetMembership.role === 'OWNER') {
    throw new ServiceError('Cannot remove the department OWNER. Transfer ownership first.', 400);
  }

  if (!isGlobalAdmin) {
    const actorMembership = await membershipRepo.findByUserAndDepartment(actorId, departmentId);
    if (actorMembership && !canManage(actorMembership.role, targetMembership.role)) {
      throw new ServiceError('Insufficient permissions to remove this member', 403);
    }
  }

  await membershipRepo.update(targetMembership.id, { status: 'REMOVED' });
  void activityLogRepo.create({
    actorUserId: actorId,
    departmentId,
    entityType: 'membership',
    entityId: targetMembership.id,
    action: 'member.removed',
    metadata: { targetUserId, role: targetMembership.role },
  });
};

// ─── Change Role ──────────────────────────────────────────────

export const changeRole = async (
  actorId: string,
  departmentId: string,
  targetUserId: string,
  newRole: DepartmentMemberRole
): Promise<DepartmentMember> => {
  const actorProfile = await profileRepo.findById(actorId);
  const isGlobalAdmin = actorProfile?.role === 'ADMIN';

  if (!isGlobalAdmin) {
    const actorMembership = await membershipRepo.findByUserAndDepartment(actorId, departmentId);
    if (!actorMembership || actorMembership.status !== 'ACTIVE') {
      throw new ServiceError('You are not a member of this department', 403);
    }
    if (!['OWNER', 'ADMIN'].includes(actorMembership.role)) {
      throw new ServiceError('Only OWNER or ADMIN can change roles', 403);
    }
  }

  const targetMembership = await membershipRepo.findByUserAndDepartment(targetUserId, departmentId);
  if (!targetMembership || targetMembership.status !== 'ACTIVE') {
    throw new ServiceError('User is not an active member of this department', 404);
  }

  if (targetMembership.role === 'OWNER') {
    throw new ServiceError('Cannot change OWNER role. Use transfer ownership.', 400);
  }

  if (newRole === 'OWNER') {
    throw new ServiceError('Cannot promote to OWNER. Use transfer ownership.', 400);
  }

  if (!isGlobalAdmin) {
    const actorMembership = await membershipRepo.findByUserAndDepartment(actorId, departmentId);
    if (actorMembership) {
      if (!canManage(actorMembership.role, targetMembership.role)) {
        throw new ServiceError('Insufficient permissions to change this member\'s role', 403);
      }
      if (actorMembership.role === 'ADMIN' && newRole === 'ADMIN') {
        throw new ServiceError('ADMIN cannot promote another user to ADMIN', 403);
      }
    }
  }

  const updated = await membershipRepo.update(targetMembership.id, { role: newRole });
  void activityLogRepo.create({
    actorUserId: actorId,
    departmentId,
    entityType: 'membership',
    entityId: updated.id,
    action: 'member.role_changed',
    metadata: { targetUserId, from: targetMembership.role, to: newRole },
  });
  return updated;
};

// ─── Transfer Ownership ───────────────────────────────────────

export const transferOwnership = async (
  actorId: string,
  departmentId: string,
  newOwnerId: string
): Promise<void> => {
  if (actorId === newOwnerId) {
    throw new ServiceError('You are already the OWNER of this department', 400);
  }

  const actorMembership = await membershipRepo.findByUserAndDepartment(actorId, departmentId);
  if (!actorMembership || actorMembership.status !== 'ACTIVE' || actorMembership.role !== 'OWNER') {
    throw new ServiceError('Only the current OWNER can transfer ownership', 403);
  }

  const targetMembership = await membershipRepo.findByUserAndDepartment(newOwnerId, departmentId);
  if (!targetMembership || targetMembership.status !== 'ACTIVE') {
    throw new ServiceError('Target user is not an active member of this department', 404);
  }

  // Atomic: demote current owner → ADMIN, promote target → OWNER
  await prisma.$transaction([
    prisma.departmentMember.update({
      where: { id: actorMembership.id },
      data: { role: 'ADMIN' },
    }),
    prisma.departmentMember.update({
      where: { id: targetMembership.id },
      data: { role: 'OWNER' },
    }),
  ]);
  void activityLogRepo.create({
    actorUserId: actorId,
    departmentId,
    entityType: 'department',
    entityId: departmentId,
    action: 'ownership.transferred',
    metadata: { from: actorId, to: newOwnerId },
  });
};
