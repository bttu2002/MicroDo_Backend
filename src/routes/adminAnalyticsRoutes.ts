import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { dateRangeQuerySchema, departmentIdParamSchema, departmentListQuerySchema } from '../schemas/analyticsSchemas';
import {
  getAdminSummary,
  getAdminCompletion,
  getAdminDeptList,
  getAdminDeptSummaryHandler,
  getAdminTrendsHandler,
  getAdminTimeHandler,
} from '../controllers/analyticsController';

const router = Router();

router.use(protect);
router.use(adminOnly);

// analyticsLimiter applied inline — router.use pattern unreliable for rate limiters in sub-routers
router.get('/summary',    analyticsLimiter, getAdminSummary);
router.get('/completion', analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getAdminCompletion);
router.get('/trends',     analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getAdminTrendsHandler);
router.get('/time',       analyticsLimiter, validateRequest({ query: dateRangeQuerySchema }), getAdminTimeHandler);
router.get('/departments',
  analyticsLimiter,
  validateRequest({ query: departmentListQuerySchema }),
  getAdminDeptList,
);
router.get('/departments/:departmentId/summary',
  analyticsLimiter,
  validateRequest({ params: departmentIdParamSchema }),
  getAdminDeptSummaryHandler,
);

export default router;
