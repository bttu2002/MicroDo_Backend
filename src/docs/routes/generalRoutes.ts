import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';

registry.registerPath({
  method: 'get',
  path: '/',
  tags: ['General'],
  summary: 'Root endpoint',
  description: 'Returns a welcome message and API status. Public — no authentication required.',
  responses: {
    200: {
      description: 'API is online',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ example: 'Welcome to MicroDo Backend API' }),
            status: z.string().openapi({ example: 'online' }),
            version: z.string().openapi({ example: '1.0.0' }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['General'],
  summary: 'Health check',
  description: 'Returns server health status and current UTC timestamp. Public — used by monitoring tools.',
  responses: {
    200: {
      description: 'Server is healthy',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string().openapi({ example: 'ok' }),
            timestamp: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/protected',
  tags: ['General'],
  summary: 'Protected test route',
  description: 'Test endpoint that verifies JWT authentication is working. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Token is valid',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string(),
            data: z.object({ user: z.object({ prismaId: z.string() }) }),
          }),
        },
      },
    },
    401: errorResponses[401],
    500: errorResponses[500],
  },
});
