import { Response, NextFunction } from 'express';
import { DepartmentMemberRole } from '@prisma/client';
import { AuthRequest } from './authMiddleware';
import prisma from '../config/prisma';

/**
 * Resolves the caller's DepartmentMember record for the target department
 * and attaches { departmentId, departmentRole } to req.user.
 *
 * Reads departmentId from req.params.departmentId, falling back to req.params.id.
 * Must run after `protect`.
 */
export const attachDepartmentContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return;
  }

  const departmentId = (req.params['departmentId'] ?? req.params['id']) as string | undefined;

  if (!departmentId) {
    next();
    return;
  }

  try {
    const membership = await prisma.departmentMember.findUnique({
      where: {
        userId_departmentId: {
          userId: req.user.prismaId,
          departmentId,
        },
      },
      select: { role: true, status: true },
    });

    req.user.departmentId = departmentId;
    req.user.departmentRole =
      membership?.status === 'ACTIVE' ? membership.role : null;

    next();
  } catch {
    res.status(500).json({ success: false, message: 'Failed to resolve department context' });
  }
};

// ─── Role-based guards ────────────────────────────────────────

/**
 * Requires the caller to hold one of the specified department roles.
 * Global ADMIN bypasses all department checks.
 * Must run after attachDepartmentContext.
 */
export const requireDepartmentRole = (...roles: DepartmentMemberRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.role === 'ADMIN') return next();

    const userRole = req.user?.departmentRole;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: `Access denied: requires one of [${roles.join(', ')}] role in this department`,
      });
      return;
    }

    next();
  };

/**
 * Requires the caller to be an active member of the department (any role).
 */
export const requireDepartmentAccess = requireDepartmentRole(
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER'
);

/**
 * Requires the caller to hold at least ADMIN-level role (OWNER or ADMIN).
 */
export const requireDepartmentAdmin = requireDepartmentRole('OWNER', 'ADMIN');
