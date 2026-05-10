import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User from '../models/User';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: {
    id: string; // Mongo ID
    email: string;
    role: string;
    // --- Added for Phase 2 Department Scoping ---
    departmentId?: string | null;
    departmentRole?: string | null; // e.g., 'DEPT_MANAGER', 'DEPT_MEMBER', 'USER', 'ADMIN'
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

    // Verify token
    const decoded = verifyToken(token);

    // Find user by id from token
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({
        success: false,
        message: 'Your account has been banned',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role || 'USER',
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized, token is invalid or expired',
    });
  }
};
