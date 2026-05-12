import { Prisma } from '@prisma/client';

/**
 * Utility to build safe Prisma `where` objects for Task queries based on RBAC rules.
 * This ensures consistency across the application when fetching tasks.
 */

export const buildPersonalTaskFilter = (profileId: string): Prisma.TaskWhereInput => {
  return { profileId };
};

export const buildDepartmentTaskFilter = (departmentId: string): Prisma.TaskWhereInput => {
  return {
    departmentId,
  };
};

/**
 * Intelligent filter builder based on the user's role and context.
 * - ADMIN: Gets everything (or based on optional filters)
 * - DEPT_MANAGER: Gets everything in their department
 * - USER/MEMBER: Gets only their personal tasks
 */
export const buildScopedTaskFilter = (
  profileId: string,
  departmentId?: string | null,
  role?: string | null
): Prisma.TaskWhereInput => {
  // 1. Admins see all
  if (role === 'ADMIN') {
    return {};
  }

  // 2. Department Managers see all tasks in their department
  if (role === 'DEPT_MANAGER' && departmentId) {
    return buildDepartmentTaskFilter(departmentId);
  }

  // 3. Regular users (or unassigned users) see only their own tasks
  return buildPersonalTaskFilter(profileId);
};

export const buildAdminTaskFilter = (
  additionalFilters?: Prisma.TaskWhereInput
): Prisma.TaskWhereInput => {
  // Admin base filter is empty (all tasks)
  // We can merge with any extra filters sent from the client (status, dates, etc.)
  return {
    ...additionalFilters,
  };
};
