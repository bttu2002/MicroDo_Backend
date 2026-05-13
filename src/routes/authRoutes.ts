import { Router } from 'express';
import { register, login, forgotPassword, resetPassword, changePassword } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../schemas/authSchemas';

const router = Router();

// POST /api/auth/register
router.post('/register', validateRequest({ body: registerSchema }), register);

// POST /api/auth/login
router.post('/login', validateRequest({ body: loginSchema }), login);

// POST /api/auth/forgot-password
router.post('/forgot-password', validateRequest({ body: forgotPasswordSchema }), forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', validateRequest({ body: resetPasswordSchema }), resetPassword);

// PUT /api/auth/change-password
router.put('/change-password', protect, validateRequest({ body: changePasswordSchema }), changePassword);

export default router;
