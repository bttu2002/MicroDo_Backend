import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { dateRangeQuerySchema } from '../schemas/analyticsSchemas';
import { getSummary, getCompletion } from '../controllers/analyticsController';

const router = Router();

router.use(protect);

// analyticsLimiter applied inline — router.use pattern unreliable for rate limiters in sub-routers
router.get('/summary',    analyticsLimiter, getSummary);
router.get('/completion', analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getCompletion);

export default router;
