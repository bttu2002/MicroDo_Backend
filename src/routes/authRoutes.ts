import { Router } from 'express';
import { register, login, forgotPassword, resetPassword, changePassword } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// PUT /api/auth/change-password
router.put('/change-password', protect, changePassword);

export default router;
