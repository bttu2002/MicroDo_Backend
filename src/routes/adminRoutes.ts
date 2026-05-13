import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { getDashboard, getUsers, banUser, unbanUser } from '../controllers/adminController';
import { assignUserToDepartment, removeUserFromDepartment } from '../controllers/departmentController';
import { getUsersQuerySchema } from '../schemas/adminSchemas';
import { assignUserToDepartmentSchema, removeUserFromDepartmentSchema } from '../schemas/departmentSchemas';

const router = Router();

router.use(protect);
router.use(adminOnly);

// GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

// GET /api/admin/users
router.get('/users', validateRequest({ query: getUsersQuerySchema }), getUsers);

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', banUser);

// PATCH /api/admin/users/:id/unban
router.patch('/users/:id/unban', unbanUser);

// PATCH /api/admin/users/:id/department
router.patch('/users/:id/department', validateRequest({ body: assignUserToDepartmentSchema }), assignUserToDepartment);

// DELETE /api/admin/users/:id/department
router.delete('/users/:id/department', validateRequest({ body: removeUserFromDepartmentSchema }), removeUserFromDepartment);

export default router;
