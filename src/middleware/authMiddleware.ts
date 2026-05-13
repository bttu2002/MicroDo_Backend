import { Request, Response, NextFunction } from 'express';
import { Role, DepartmentMemberRole } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { sendError } from '../utils/apiResponse';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;        // MongoId — JWT identity, preserved for backward compat during transition
    prismaId: string;  // Prisma Profile UUID — canonical identity for Phase 4.4+
    email: string;
    role: Role;        // source of truth is now Prisma Profile
    // --- Department context, populated by attachDepartmentContext middleware ---
    departmentId?: string | null;
    departmentRole?: DepartmentMemberRole | null;
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

    if (!token) {
      logger.warn({ requestId: req.requestId, reason: 'no_token', path: req.originalUrl }, 'Auth rejected');
      sendError(res, req, 401, 'UNAUTHORIZED', 'Not authorized, no token provided');
      return;
    }

    // Verify token — JWT payload still contains MongoId, existing tokens continue to work
    const decoded = verifyToken(token);

    // Phase 4.3: JWT now carries Prisma UUID; look up by primary key id
    const profile = await prisma.profile.findUnique({
      where:  { id: decoded.id },
      select: { id: true, email: true, role: true, status: true, mongoId: true },
    });

    if (!profile) {
      logger.warn({ requestId: req.requestId, reason: 'user_not_found', path: req.originalUrl }, 'Auth rejected');
      sendError(res, req, 401, 'UNAUTHORIZED', 'Not authorized, user profile not found');
      return;
    }

    if (profile.status === 'BANNED') {
      logger.warn({ requestId: req.requestId, reason: 'banned', userId: profile.id, path: req.originalUrl }, 'Auth rejected');
      sendError(res, req, 403, 'FORBIDDEN', 'Your account has been banned');
      return;
    }

    req.user = {
      id:       profile.mongoId ?? profile.id,  // MongoId for backward compat; UUID fallback
      prismaId: profile.id,
      email:    profile.email,
      role:     profile.role,
    };

    next();
  } catch (error) {
    logger.warn({ requestId: req.requestId, reason: 'invalid_token', path: req.originalUrl }, 'Auth rejected');
    sendError(res, req, 401, 'UNAUTHORIZED', 'Not authorized, token is invalid or expired');
  }
};
