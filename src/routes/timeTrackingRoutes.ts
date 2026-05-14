import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { timeTrackingLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { startSessionBodySchema, sessionListQuerySchema } from '../schemas/timeTrackingSchemas';
import {
  startSession,
  stopSession,
  getActiveSession,
  listSessions,
} from '../controllers/timeTrackingController';

const router = Router();

router.use(protect);

// timeTrackingLimiter applied inline — router.use pattern unreliable for rate limiters in sub-routers
router.post('/sessions/start',  timeTrackingLimiter, validateRequest({ body: startSessionBodySchema }), startSession);
router.post('/sessions/stop',   timeTrackingLimiter, stopSession);
router.get('/sessions/active',  timeTrackingLimiter, getActiveSession);
router.get('/sessions',         timeTrackingLimiter, validateRequest({ query: sessionListQuerySchema }), listSessions);

export default router;
