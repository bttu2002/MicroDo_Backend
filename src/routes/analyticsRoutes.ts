import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { getSummary } from '../controllers/analyticsController';

const router = Router();

router.use(protect);

// GET /api/analytics/summary — analyticsLimiter inline (router.use pattern unreliable for rate limiters in sub-routers)
router.get('/summary', analyticsLimiter, getSummary);

export default router;
