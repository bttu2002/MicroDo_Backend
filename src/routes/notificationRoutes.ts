import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { notificationLimiter } from '../middleware/rateLimiter';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController';

const router = Router();

// protect runs first → then user-based rate limiter → then route handlers
router.use(protect);
router.use(notificationLimiter);

// IMPORTANT: read-all must be defined BEFORE /:id/read
// to prevent "read-all" being matched as :id
router.patch('/read-all', markAllRead);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markRead);

export default router;
