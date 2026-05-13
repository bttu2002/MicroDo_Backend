import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  attachDepartmentContext,
  requireDepartmentAccess,
  requireDepartmentAdmin,
} from '../middleware/departmentMiddleware';
import {
  listDepartmentMembers,
  addDepartmentMember,
  removeDepartmentMember,
  changeMemberRole,
  transferOwnership,
} from '../controllers/departmentController';
import {
  sendInvitation,
  listInvitations,
  cancelInvitation,
} from '../controllers/invitationController';
import {
  addMemberSchema,
  changeMemberRoleSchema,
  transferOwnershipSchema,
} from '../schemas/departmentSchemas';
import { sendInvitationSchema } from '../schemas/invitationSchemas';

const router = Router();

router.use(protect);

// All routes require resolving department context first
router.use('/:departmentId', attachDepartmentContext);

// ─── Member management ──────────────────────────────────────

// GET    /api/departments/:departmentId/members
router.get('/:departmentId/members', requireDepartmentAccess, listDepartmentMembers);

// POST   /api/departments/:departmentId/members
router.post('/:departmentId/members', requireDepartmentAdmin, validateRequest({ body: addMemberSchema }), addDepartmentMember);

// DELETE /api/departments/:departmentId/members/:userId
router.delete('/:departmentId/members/:userId', requireDepartmentAdmin, removeDepartmentMember);

// PATCH  /api/departments/:departmentId/members/:userId/role
router.patch('/:departmentId/members/:userId/role', requireDepartmentAdmin, validateRequest({ body: changeMemberRoleSchema }), changeMemberRole);

// POST   /api/departments/:departmentId/transfer-ownership
router.post(
  '/:departmentId/transfer-ownership',
  requireDepartmentAdmin,
  validateRequest({ body: transferOwnershipSchema }),
  transferOwnership
);

// ─── Invitations (department-scoped) ─────────────────────────

// POST   /api/departments/:departmentId/invitations
router.post('/:departmentId/invitations', requireDepartmentAdmin, validateRequest({ body: sendInvitationSchema }), sendInvitation);

// GET    /api/departments/:departmentId/invitations
router.get('/:departmentId/invitations', requireDepartmentAdmin, listInvitations);

// DELETE /api/departments/:departmentId/invitations/:invitationId
router.delete('/:departmentId/invitations/:invitationId', requireDepartmentAdmin, cancelInvitation);

export default router;
