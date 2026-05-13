import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController';

const router = Router();

router.use(protect);

// IMPORTANT: read-all must be defined BEFORE /:id/read
// to prevent "read-all" being matched as :id
router.patch('/read-all', markAllRead);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markRead);

export default router;
