import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../schemas/authSchemas';

const UserAuthDataSchema = z.object({
  _id: z.string().nullable().openapi({ example: '507f1f77bcf86cd799439011' }),
  id: z.string().uuid().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  role: z.enum(['USER', 'ADMIN']).openapi({ example: 'USER' }),
  status: z.enum(['ACTIVE', 'BANNED']).openapi({ example: 'ACTIVE' }),
  token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
}).openapi('UserAuthData');

registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  description: 'Creates a new USER account. Returns the created profile without a JWT token. Public — no authentication required.',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: registerSchema } },
    },
  },
  responses: {
    201: {
      description: 'User registered successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'User registered successfully' }),
            data: z.object({
              id: z.string().uuid(),
              email: z.string().email(),
              role: z.enum(['USER', 'ADMIN']),
              status: z.enum(['ACTIVE', 'BANNED']),
              createdAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
            }),
          }),
        },
      },
    },
    400: errorResponses[400],
    409: errorResponses[409],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Login with email and password',
  description: 'Authenticates a user and returns a JWT token for use in the Authorization header. Public — no authentication required.',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: loginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Login successful' }),
            data: UserAuthDataSchema,
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/forgot-password',
  tags: ['Auth'],
  summary: 'Request a password reset link',
  description: 'Sends a password reset email if the account exists. Always returns 200 to prevent email enumeration. Public — no authentication required.',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: forgotPasswordSchema } },
    },
  },
  responses: {
    200: {
      description: 'Reset link sent (or silently skipped if email not found)',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({
              example: 'If an account with that email exists, a reset link has been sent',
            }),
          }),
        },
      },
    },
    400: errorResponses[400],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/reset-password',
  tags: ['Auth'],
  summary: 'Reset password using token',
  description: 'Resets the user password using the token received by email. Token is valid for 15 minutes. Returns a new JWT token on success. Public — no authentication required.',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: resetPasswordSchema } },
    },
  },
  responses: {
    200: {
      description: 'Password reset successful',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Password reset successful' }),
            data: UserAuthDataSchema,
          }),
        },
      },
    },
    400: errorResponses[400],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/auth/change-password',
  tags: ['Auth'],
  summary: 'Change password (authenticated)',
  description: 'Changes the current password for the authenticated user. Requires the correct current password. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: changePasswordSchema } },
    },
  },
  responses: {
    200: {
      description: 'Password changed successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Password successfully changed' }),
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});
