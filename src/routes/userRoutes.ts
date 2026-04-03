import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Apply protect middleware to all routes in this file
router.use(protect);

// GET /api/user/profile
router.get('/profile', getProfile);

// PUT /api/user/profile
router.put('/profile', updateProfile);

export default router;
