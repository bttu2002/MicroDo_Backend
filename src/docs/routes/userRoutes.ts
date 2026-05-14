import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import { updateProfileSchema } from '../../schemas/userSchemas';

const ProfileSchema = z.object({
  _id: z.string().nullable().openapi({ example: '507f1f77bcf86cd799439011' }),
  id: z.string().uuid().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().nullable().openapi({ example: 'John Doe' }),
  username: z.string().nullable().openapi({ example: 'johndoe' }),
  avatar: z.string().nullable().openapi({ example: 'https://example.com/avatar.png' }),
  role: z.enum(['USER', 'ADMIN']).openapi({ example: 'USER' }),
  status: z.enum(['ACTIVE', 'BANNED']).openapi({ example: 'ACTIVE' }),
  createdAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
  __v: z.number().openapi({ example: 0 }),
}).openapi('UserProfile');

registry.registerPath({
  method: 'get',
  path: '/api/user/profile',
  tags: ['User'],
  summary: 'Get current user profile',
  description: 'Returns the full profile of the authenticated user, including name, username, avatar, role, and status. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'User profile',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: ProfileSchema,
          }),
        },
      },
    },
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/user/profile',
  tags: ['User'],
  summary: 'Update current user profile',
  description: 'Updates one or more profile fields (name, email, username, avatar) for the authenticated user. Email and username must be unique across the system. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: updateProfileSchema } },
    },
  },
  responses: {
    200: {
      description: 'Profile updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Profile updated successfully' }),
            data: ProfileSchema,
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});
