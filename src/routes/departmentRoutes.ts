import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController';

const router = Router();

// Protect all admin routes with auth and admin middlewares
router.use(protect);
router.use(adminOnly);

// POST /api/admin/departments
router.post('/', createDepartment);

// GET /api/admin/departments
router.get('/', getDepartments);

// GET /api/admin/departments/:id
router.get('/:id', getDepartmentById);

// PATCH /api/admin/departments/:id
router.patch('/:id', updateDepartment);

// DELETE /api/admin/departments/:id
router.delete('/:id', deleteDepartment);

export default router;
