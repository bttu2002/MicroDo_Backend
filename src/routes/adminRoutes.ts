import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { getDashboard } from '../controllers/adminController';

const router = Router();

// Protect all admin routes with auth and admin middlewares
router.use(protect);
router.use(adminOnly);

// GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

export default router;
