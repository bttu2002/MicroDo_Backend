import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { getDashboard, getUsers, banUser, unbanUser } from '../controllers/adminController';

const router = Router();

// Protect all admin routes with auth and admin middlewares
router.use(protect);
router.use(adminOnly);

// GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

// GET /api/admin/users
router.get('/users', getUsers);

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', banUser);

// PATCH /api/admin/users/:id/unban
router.patch('/users/:id/unban', unbanUser);

export default router;
