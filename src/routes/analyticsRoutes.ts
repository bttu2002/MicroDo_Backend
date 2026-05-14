import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { dateRangeQuerySchema, departmentIdParamSchema, departmentListQuerySchema } from '../schemas/analyticsSchemas';
import { getSummary, getCompletion, getDeptSummary, getDeptCompletion, getTrends, getTime } from '../controllers/analyticsController';

const router = Router();

router.use(protect);

// analyticsLimiter applied inline — router.use pattern unreliable for rate limiters in sub-routers
router.get('/summary',    analyticsLimiter, getSummary);
router.get('/completion', analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getCompletion);
router.get('/trends',     analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getTrends);
router.get('/time',       analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getTime);
router.get('/departments/:departmentId/summary',
  analyticsLimiter,
  validateRequest({ params: departmentIdParamSchema }),
  getDeptSummary,
);
router.get('/departments/:departmentId/completion',
  analyticsLimiter,
  validateRequest({ params: departmentIdParamSchema, query: dateRangeQuerySchema }),
  getDeptCompletion,
);

export default router;
