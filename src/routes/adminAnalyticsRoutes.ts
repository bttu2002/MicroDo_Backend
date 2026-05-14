import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { getAdminSummary } from '../controllers/analyticsController';

const router = Router();

router.use(protect);
router.use(adminOnly);

// GET /api/admin/analytics/summary — analyticsLimiter inline (router.use pattern unreliable for rate limiters in sub-routers)
router.get('/summary', analyticsLimiter, getAdminSummary);

export default router;
