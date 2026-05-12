import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;        // MongoId — JWT identity, preserved for backward compat during transition
    prismaId: string;  // Prisma Profile UUID — canonical identity for Phase 4.4+
    email: string;
    role: Role;        // source of truth is now Prisma Profile
    // --- Department context, populated by attachDepartmentContext middleware ---
    departmentId?: string | null;
    departmentRole?: string | null;
  };
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
      return;
    }

    // Verify token — JWT payload still contains MongoId, existing tokens continue to work
    const decoded = verifyToken(token);

    // Phase 4.2: look up Prisma Profile by mongoId instead of MongoDB User.findById()
    // Role/status source of truth is now Prisma Profile
    const profile = await prisma.profile.findUnique({
      where:  { mongoId: decoded.id },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!profile) {
      res.status(401).json({
        success: false,
        message: 'Not authorized, user profile not found',
      });
      return;
    }

    if (profile.status === 'BANNED') {
      res.status(403).json({
        success: false,
        message: 'Your account has been banned',
      });
      return;
    }

    req.user = {
      id:       decoded.id,   // MongoId — kept for all existing downstream consumers
      prismaId: profile.id,   // Prisma UUID — available for Phase 4.4+ consumers
      email:    profile.email,
      role:     profile.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized, token is invalid or expired',
    });
  }
};
