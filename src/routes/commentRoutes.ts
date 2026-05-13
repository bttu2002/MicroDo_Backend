import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController';

const router = Router();

// Task-scoped comment routes
// GET  /api/tasks/:taskId/comments
// POST /api/tasks/:taskId/comments
router.get('/tasks/:taskId/comments', protect, getComments);
router.post('/tasks/:taskId/comments', protect, createComment);

// Comment-scoped routes
// PATCH  /api/comments/:commentId
// DELETE /api/comments/:commentId
router.patch('/comments/:commentId', protect, updateComment);
router.delete('/comments/:commentId', protect, deleteComment);

export default router;
