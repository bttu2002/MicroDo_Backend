import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import prisma from '../config/prisma';

/**
 * Middleware: Attach Department Context
 * Looks up the Prisma Profile via mongoId and attaches department info to the request.
 * Useful as a precursor to other scoped middlewares or controllers.
 */
export const attachDepartmentContext = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      success: false,
      message: 'User not authenticated',
    });
    return;
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: req.user.prismaId },
      select: { departmentId: true, role: true },
    });

    if (profile) {
      req.user.departmentId = profile.departmentId;
      req.user.departmentRole = profile.role;
    } else {
      req.user.departmentId = null;
      req.user.departmentRole = null;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve department context',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Middleware: Require Department Member
 * Ensures the user belongs to the requested department in params or body.
 * Admins can bypass this check.
 */
export const requireDepartmentMember = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Admins have global access
  if (req.user?.role === 'ADMIN' || req.user?.departmentRole === 'ADMIN') {
    return next();
  }

  const requestedDepartmentId = req.params.departmentId || req.body.departmentId;

  if (!requestedDepartmentId) {
    res.status(400).json({
      success: false,
      message: 'departmentId is required to verify access',
    });
    return;
  }

  if (req.user?.departmentId !== requestedDepartmentId) {
    res.status(403).json({
      success: false,
      message: 'Access denied: You are not a member of this department',
    });
    return;
  }

  next();
};

/**
 * Middleware: Require Department Manager
 * Ensures the user is a DEPT_MANAGER for the requested department.
 * Admins can bypass this check.
 */
export const requireDepartmentManager = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Admins have global access
  if (req.user?.role === 'ADMIN' || req.user?.departmentRole === 'ADMIN') {
    return next();
  }

  const requestedDepartmentId = req.params.departmentId || req.body.departmentId;

  if (!requestedDepartmentId) {
    res.status(400).json({
      success: false,
      message: 'departmentId is required to verify manager access',
    });
    return;
  }

  if (req.user?.departmentId !== requestedDepartmentId) {
    res.status(403).json({
      success: false,
      message: 'Access denied: You do not belong to this department',
    });
    return;
  }

  if (req.user?.departmentRole !== 'DEPT_MANAGER') {
    res.status(403).json({
      success: false,
      message: 'Access denied: Department Manager role required',
    });
    return;
  }

  next();
};

/**
 * Middleware: Scoped Department Access
 * A generic middleware that enforces scoping. If the user is an admin, they can access
 * anything. If they are a regular user, it forces the query/body context to their own department.
 */
export const scopedDepartmentAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role === 'ADMIN' || req.user?.departmentRole === 'ADMIN') {
    return next();
  }

  // If the user has no department, they cannot access department-scoped resources
  if (!req.user?.departmentId) {
    res.status(403).json({
      success: false,
      message: 'Access denied: You are not assigned to any department',
    });
    return;
  }

  // Override req.query or req.body to forcefully scope it to their department
  if (req.method === 'GET') {
    req.query.departmentId = req.user.departmentId;
  } else {
    // For POST/PATCH, force the departmentId to be their own
    req.body.departmentId = req.user.departmentId;
  }

  next();
};
