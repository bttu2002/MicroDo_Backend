import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import { startSessionBodySchema } from '../../schemas/timeTrackingSchemas';

const TimeSessionSchema = z.object({
  id: z.string().uuid().openapi({ example: 'session-uuid-1234' }),
  profileId: z.string().uuid(),
  taskId: z.string().uuid(),
  startedAt: z.string().openapi({ example: '2026-05-14T09:00:00.000Z' }),
  stoppedAt: z.string().nullable().openapi({ example: null }),
  durationSeconds: z.number().nullable().openapi({ description: 'Duration in seconds. Null if session is still active.', example: null }),
}).openapi('TimeSession');

const sessionListQuery = z.object({
  startDate: z.string().openapi({ example: '2026-05-01', description: 'Start date YYYY-MM-DD (UTC)' }),
  endDate: z.string().openapi({ example: '2026-05-14', description: 'End date YYYY-MM-DD (UTC). Max range: 365 days.' }),
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
});

registry.registerPath({
  method: 'post',
  path: '/api/time-tracking/sessions/start',
  tags: ['Time Tracking'],
  summary: 'Start a time tracking session',
  description: 'Starts a new time tracking session for the specified task. Only one active session is allowed at a time per user — returns 409 if a session is already running. The user must own the task. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: startSessionBodySchema } },
    },
  },
  responses: {
    201: {
      description: 'Session started successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TimeSessionSchema,
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    409: errorResponses[409],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/time-tracking/sessions/stop',
  tags: ['Time Tracking'],
  summary: 'Stop the active time tracking session',
  description: 'Stops the currently running time tracking session for the authenticated user. Duration is calculated server-side in seconds. Returns 404 if no session is active. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Session stopped successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TimeSessionSchema,
          }),
        },
      },
    },
    401: errorResponses[401],
    404: errorResponses[404],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/time-tracking/sessions/active',
  tags: ['Time Tracking'],
  summary: 'Get the active time tracking session',
  description: 'Returns the currently running time tracking session for the authenticated user, or null if no session is active. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Active session (or null)',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TimeSessionSchema.nullable().openapi({ description: 'Null if no session is currently active' }),
          }),
        },
      },
    },
    401: errorResponses[401],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/time-tracking/sessions',
  tags: ['Time Tracking'],
  summary: 'List time tracking sessions',
  description: 'Returns a paginated list of completed time tracking sessions for the authenticated user within a date range. Only sessions with a stoppedAt timestamp are included. All dates UTC. Max range: 365 days. Requires User or Admin role.',
  security: bearerSecurity,
  request: { query: sessionListQuery },
  responses: {
    200: {
      description: 'Paginated session list with aggregate summary',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              period: z.object({
                startDate: z.string().openapi({ example: '2026-05-01' }),
                endDate: z.string().openapi({ example: '2026-05-14' }),
              }),
              summary: z.object({
                totalDurationSeconds: z.number().openapi({ example: 3600 }),
                sessionCount: z.number().openapi({ example: 3 }),
                averageSessionSeconds: z.number().nullable().openapi({ example: 1200 }),
              }),
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
                totalPages: z.number(),
              }),
              sessions: z.array(TimeSessionSchema),
            }),
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
