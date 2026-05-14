import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import { getUsersQuerySchema } from '../../schemas/adminSchemas';
import { assignUserToDepartmentSchema, removeUserFromDepartmentSchema } from '../../schemas/departmentSchemas';

const adminSecurity = bearerSecurity;
const adminDescription = 'Requires Admin role.';

const AdminUserSchema = z.object({
  _id: z.string().nullable().openapi({ example: '507f1f77bcf86cd799439011' }),
  id: z.string().uuid().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().nullable().openapi({ example: 'John Doe' }),
  username: z.string().nullable().openapi({ example: 'johndoe' }),
  role: z.enum(['USER', 'ADMIN']).openapi({ example: 'USER' }),
  status: z.enum(['ACTIVE', 'BANNED']).openapi({ example: 'ACTIVE' }),
  createdAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
}).openapi('AdminUser');

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/dashboard',
  tags: ['Admin'],
  summary: 'Get admin dashboard stats',
  description: `Returns system-wide totals: total users, banned users, and total tasks. ${adminDescription}`,
  security: adminSecurity,
  responses: {
    200: {
      description: 'Dashboard statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              totalUsers: z.number().openapi({ example: 150 }),
              bannedUsers: z.number().openapi({ example: 3 }),
              totalTasks: z.number().openapi({ example: 420 }),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  tags: ['Admin'],
  summary: 'List all users (admin)',
  description: `Returns a paginated list of all user profiles in the system. Supports email search. ${adminDescription}`,
  security: adminSecurity,
  request: { query: getUsersQuerySchema },
  responses: {
    200: {
      description: 'Paginated user list',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              users: z.array(AdminUserSchema),
              pagination: z.object({
                currentPage: z.number().openapi({ example: 1 }),
                totalPages: z.number().openapi({ example: 5 }),
                totalUsers: z.number().openapi({ example: 50 }),
                limit: z.number().openapi({ example: 10 }),
              }),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/admin/users/{id}/ban',
  tags: ['Admin'],
  summary: 'Ban a user',
  description: `Sets a user's status to BANNED, preventing them from logging in. An admin cannot ban themselves. ${adminDescription}`,
  security: adminSecurity,
  request: { params: uuidParam },
  responses: {
    200: {
      description: 'User banned successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'User has been banned' }),
            data: z.object({
              _id: z.string().nullable(),
              id: z.string().uuid(),
              email: z.string().email(),
              status: z.literal('BANNED'),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/admin/users/{id}/unban',
  tags: ['Admin'],
  summary: 'Unban a user',
  description: `Restores a banned user's status to ACTIVE, allowing them to log in again. ${adminDescription}`,
  security: adminSecurity,
  request: { params: uuidParam },
  responses: {
    200: {
      description: 'User unbanned successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'User has been unbanned' }),
            data: z.object({
              _id: z.string().nullable(),
              id: z.string().uuid(),
              email: z.string().email(),
              status: z.literal('ACTIVE'),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/admin/users/{id}/department',
  tags: ['Admin'],
  summary: 'Assign user to department (admin)',
  description: `Assigns a user to a specific department with an optional role. ${adminDescription}`,
  security: adminSecurity,
  request: {
    params: uuidParam,
    body: {
      required: true,
      content: { 'application/json': { schema: assignUserToDepartmentSchema } },
    },
  },
  responses: {
    200: {
      description: 'User assigned to department',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
            data: z.object({}).passthrough(),
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/admin/users/{id}/department',
  tags: ['Admin'],
  summary: 'Remove user from department (admin)',
  description: `Removes a user from a specific department. ${adminDescription}`,
  security: adminSecurity,
  request: {
    params: uuidParam,
    body: {
      required: true,
      content: { 'application/json': { schema: removeUserFromDepartmentSchema } },
    },
  },
  responses: {
    200: {
      description: 'User removed from department',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});
