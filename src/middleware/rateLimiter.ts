import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { AuthRequest } from './authMiddleware';
import logger from '../config/logger';

// Shared 429 response body — follows RULE D
const rateLimitBody = {
  success: false,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Too many requests, please try again later.',
};

// Health-check paths are never rate-limited
const isHealthCheck = (req: Request): boolean =>
  req.path === '/health' || req.path === '/';

// ─── Auth limiter — IP-based ──────────────────────────────────
// Protects login / register / forgot-password
// 20 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isHealthCheck,
  handler: (_req: Request, res: Response): void => {
    res.status(429).json(rateLimitBody);
  },
});

// ─── Comment write limiter — user-based ──────────────────────
// Applies to POST / PATCH / DELETE on comments
// Falls back to IP if user not yet resolved (should not happen in practice)
// 30 requests per minute per user
export const commentWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isHealthCheck,
  keyGenerator: (req: Request): string => {
    const userId = (req as AuthRequest).user?.prismaId;
    return userId ?? 'unknown';
  },
  handler: (_req: Request, res: Response): void => {
    res.status(429).json(rateLimitBody);
  },
});

// ─── Task write limiter — user-based ─────────────────────────
// Applies to POST / PUT / DELETE on task routes
// 60 requests per minute per user
// No skip: write routes are never health checks (GET-only), and req.path is
// router-relative so checking '/' would incorrectly match POST /api/tasks
export const taskWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = (req as AuthRequest).user?.prismaId;
    if (userId !== undefined) return userId;
    logger.warn(
      { requestId: req.requestId, path: req.path },
      'Rate limiter fallback to IP because req.user missing'
    );
    return ipKeyGenerator(req.ip ?? 'unknown');
  },
  handler: (req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      requestId: req.requestId,
    });
  },
});

// ─── Department write limiter — user-based ───────────────────
// Applies to POST / PATCH / PUT / DELETE on department and membership routes
// 30 requests per minute per user
// No skip: same reason as taskWriteLimiter — health checks are GET-only
export const departmentWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = (req as AuthRequest).user?.prismaId;
    if (userId !== undefined) return userId;
    logger.warn(
      { requestId: req.requestId, path: req.path },
      'Rate limiter fallback to IP because req.user missing'
    );
    return ipKeyGenerator(req.ip ?? 'unknown');
  },
  handler: (req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
      requestId: req.requestId,
    });
  },
});

// ─── Notification limiter — user-based ───────────────────────
// Covers all notification endpoints (reads + writes)
// 120 requests per minute per user
export const notificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isHealthCheck,
  keyGenerator: (req: Request): string => {
    const userId = (req as AuthRequest).user?.prismaId;
    return userId ?? 'unknown';
  },
  handler: (_req: Request, res: Response): void => {
    res.status(429).json(rateLimitBody);
  },
});
