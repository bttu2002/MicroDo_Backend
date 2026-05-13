import { Router } from 'express';
import { protect } from '../middleware/authMiddleware';
import { adminOnly } from '../middleware/adminMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import { departmentWriteLimiter } from '../middleware/rateLimiter';
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  deleteDepartmentQuerySchema,
  getDepartmentsQuerySchema,
} from '../schemas/departmentSchemas';
import { uuidParamSchema } from '../schemas/commonSchemas';

const router = Router();

router.use(protect);
router.use(adminOnly);

// POST /api/admin/departments
router.post('/', departmentWriteLimiter, validateRequest({ body: createDepartmentSchema }), createDepartment);

// GET /api/admin/departments
router.get('/', validateRequest({ query: getDepartmentsQuerySchema }), getDepartments);

// GET /api/admin/departments/:id
router.get('/:id', validateRequest({ params: uuidParamSchema }), getDepartmentById);

// PATCH /api/admin/departments/:id
router.patch('/:id', departmentWriteLimiter, validateRequest({ params: uuidParamSchema, body: updateDepartmentSchema }), updateDepartment);

// DELETE /api/admin/departments/:id
router.delete('/:id', departmentWriteLimiter, validateRequest({ params: uuidParamSchema, query: deleteDepartmentQuerySchema }), deleteDepartment);

export default router;
