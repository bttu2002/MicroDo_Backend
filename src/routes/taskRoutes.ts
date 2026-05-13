import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { createTask, getTasks, updateTask, deleteTask, getTaskStats } from '../controllers/taskController';
import { createTaskSchema, updateTaskSchema, getTasksQuerySchema } from '../schemas/taskSchemas';

const router = Router();

// All task routes are protected
router.use(protect);

// POST /api/tasks
router.post('/', validateRequest({ body: createTaskSchema }), createTask);

// GET /api/tasks
router.get('/', validateRequest({ query: getTasksQuerySchema }), getTasks);

// GET /api/tasks/stats
router.get('/stats', getTaskStats);

// PUT /api/tasks/:id
router.put('/:id', validateRequest({ body: updateTaskSchema }), updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', deleteTask);

export default router;
