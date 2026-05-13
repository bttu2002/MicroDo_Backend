import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { acceptInvitation, rejectInvitation } from '../controllers/invitationController';

const router = Router();

// POST /api/invitations/:token/accept — authenticated (must match invited email)
router.post('/:token/accept', protect, acceptInvitation);

// POST /api/invitations/:token/reject — authenticated (must match invited email)
router.post('/:token/reject', protect, rejectInvitation);

export default router;
