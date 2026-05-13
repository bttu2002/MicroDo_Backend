import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { taskWriteLimiter } from '../middleware/rateLimiter';
import { createTask, getTasks, updateTask, deleteTask, getTaskStats } from '../controllers/taskController';
import { createTaskSchema, updateTaskSchema, getTasksQuerySchema } from '../schemas/taskSchemas';

const router = Router();

// All task routes are protected
router.use(protect);

// POST /api/tasks
router.post('/', taskWriteLimiter, validateRequest({ body: createTaskSchema }), createTask);

// GET /api/tasks
router.get('/', validateRequest({ query: getTasksQuerySchema }), getTasks);

// GET /api/tasks/stats
router.get('/stats', getTaskStats);

// PUT /api/tasks/:id
router.put('/:id', taskWriteLimiter, validateRequest({ body: updateTaskSchema }), updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', taskWriteLimiter, deleteTask);

export default router;
