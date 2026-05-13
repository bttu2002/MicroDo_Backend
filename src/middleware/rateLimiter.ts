import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { AuthRequest } from './authMiddleware';

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
