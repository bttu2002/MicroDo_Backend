import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { commentWriteLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController';
import { createCommentSchema, updateCommentSchema, getCommentsQuerySchema } from '../schemas/commentSchemas';

const router = Router();

// GET /api/tasks/:taskId/comments — no write limiter (reads are cheap)
router.get('/tasks/:taskId/comments', protect, validateRequest({ query: getCommentsQuerySchema }), getComments);

// POST /api/tasks/:taskId/comments — protect first → then user-based rate limit → then validate
router.post('/tasks/:taskId/comments', protect, commentWriteLimiter, validateRequest({ body: createCommentSchema }), createComment);

// PATCH /api/comments/:commentId — protect first → then user-based rate limit → then validate
router.patch('/comments/:commentId', protect, commentWriteLimiter, validateRequest({ body: updateCommentSchema }), updateComment);

// DELETE /api/comments/:commentId — protect first → then user-based rate limit
router.delete('/comments/:commentId', protect, commentWriteLimiter, deleteComment);

export default router;
