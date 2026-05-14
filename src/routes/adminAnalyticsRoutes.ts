import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { dateRangeQuerySchema } from '../schemas/analyticsSchemas';
import { getAdminSummary, getAdminCompletion } from '../controllers/analyticsController';

const router = Router();

router.use(protect);
router.use(adminOnly);

// analyticsLimiter applied inline — router.use pattern unreliable for rate limiters in sub-routers
router.get('/summary',    analyticsLimiter, getAdminSummary);
router.get('/completion', analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getAdminCompletion);

export default router;
