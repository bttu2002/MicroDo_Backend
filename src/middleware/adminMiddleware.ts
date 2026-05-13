import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { sendError } from '../utils/apiResponse';

export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    sendError(res, req, 403, 'FORBIDDEN', 'Not authorized as an admin');
  }
};
