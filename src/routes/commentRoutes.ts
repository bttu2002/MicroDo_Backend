import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { commentWriteLimiter } from '../middleware/rateLimiter';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController';

const router = Router();

// GET /api/tasks/:taskId/comments — no write limiter (reads are cheap)
router.get('/tasks/:taskId/comments', protect, getComments);

// POST /api/tasks/:taskId/comments — protect first → then user-based rate limit
router.post('/tasks/:taskId/comments', protect, commentWriteLimiter, createComment);

// PATCH /api/comments/:commentId — protect first → then user-based rate limit
router.patch('/comments/:commentId', protect, commentWriteLimiter, updateComment);

// DELETE /api/comments/:commentId — protect first → then user-based rate limit
router.delete('/comments/:commentId', protect, commentWriteLimiter, deleteComment);

export default router;
