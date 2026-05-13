import { Task, Profile } from '@prisma/client';
import { IMembershipRepository } from '../repositories/interfaces';

export class TaskPermissionError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'TaskPermissionError';
  }
}

/**
 * Validates whether a user has the required permission level on a task.
 * Single source of truth for task RBAC — reused by taskService and commentService.
 */
export async function resolveTaskPermission(
  task: Task,
  profileId: string,
  profile: Profile,
  level: 'read' | 'write' | 'delete',
  membershipRepo: IMembershipRepository
): Promise<void> {
  if (profile.role === 'ADMIN') return;

  if (task.departmentId) {
    const membership = await membershipRepo.findByUserAndDepartment(
      profileId,
      task.departmentId
    );

    if (!membership || membership.status !== 'ACTIVE') {
      if (task.profileId !== profileId) {
        throw new TaskPermissionError('Not authorized to access this task', 403);
      }
      return;
    }

    if (level !== 'read' && membership.role === 'VIEWER') {
      throw new TaskPermissionError('VIEWER cannot modify tasks', 403);
    }

    if (
      level !== 'read' &&
      membership.role === 'MEMBER' &&
      task.profileId !== profileId
    ) {
      throw new TaskPermissionError('MEMBER can only modify their own tasks', 403);
    }

    return;
  }

  if (task.profileId !== profileId) {
    throw new TaskPermissionError('Not authorized to access this task', 403);
  }
}
