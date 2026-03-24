import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { createTask, getTasks, updateTask, deleteTask } from '../controllers/taskController';

const router = Router();

// All task routes are protected
router.use(protect);

// POST /api/tasks
router.post('/', createTask);

// GET /api/tasks
router.get('/', getTasks);

// PUT /api/tasks/:id
router.put('/:id', updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', deleteTask);

export default router;
