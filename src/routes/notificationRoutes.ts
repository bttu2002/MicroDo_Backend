import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { notificationLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController';
import { getNotificationsQuerySchema } from '../schemas/notificationSchemas';
import { uuidParamSchema } from '../schemas/commonSchemas';

const router = Router();

// protect runs first → then user-based rate limiter → then route handlers
router.use(protect);
router.use(notificationLimiter);

// IMPORTANT: read-all must be defined BEFORE /:id/read
// to prevent "read-all" being matched as :id
router.patch('/read-all', markAllRead);

router.get('/', validateRequest({ query: getNotificationsQuerySchema }), getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', validateRequest({ params: uuidParamSchema }), markRead);

export default router;
