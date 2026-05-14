import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import { departmentIdParamSchema, departmentListQuerySchema } from '../../schemas/analyticsSchemas';

const adminSecurity = bearerSecurity;

const dateRangeQuery = z.object({
  startDate: z.string().openapi({ example: '2026-04-01', description: 'Start date in YYYY-MM-DD format (UTC)' }),
  endDate: z.string().openapi({ example: '2026-04-30', description: 'End date in YYYY-MM-DD format (UTC). Cannot be in the future. Max range: 365 days.' }),
});

const PeriodSchema = z.object({
  startDate: z.string().openapi({ example: '2026-04-01' }),
  endDate: z.string().openapi({ example: '2026-04-30' }),
});

const HeatmapBucketSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).openapi({ description: '0=Sunday, 6=Saturday', example: 1 }),
  hour: z.number().int().min(0).max(23).openapi({ example: 9 }),
  created: z.number().openapi({ example: 15 }),
  completed: z.number().openapi({ example: 10 }),
  total: z.number().openapi({ example: 25 }),
});

const HeatmapSummarySchema = z.object({
  peakDayOfWeek: z.number().int().nullable().openapi({ example: 1 }),
  peakHour: z.number().int().nullable().openapi({ example: 10 }),
  totalCreated: z.number().openapi({ example: 320 }),
  totalCompleted: z.number().openapi({ example: 245 }),
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/analytics/summary',
  tags: ['Admin Analytics'],
  summary: 'Get system-wide task summary (admin)',
  description: 'Returns aggregated task counts across ALL users in the system grouped by status (todo, doing, done). Includes overdue count. All data UTC. Requires Admin role.',
  security: adminSecurity,
  responses: {
    200: {
      description: 'System-wide task summary',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              total: z.number().openapi({ example: 850 }),
              todo: z.number().openapi({ example: 200 }),
              doing: z.number().openapi({ example: 150 }),
              done: z.number().openapi({ example: 500 }),
              overdue: z.number().openapi({ example: 30 }),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/analytics/completion',
  tags: ['Admin Analytics'],
  summary: 'Get system-wide completion stats (admin)',
  description: 'Returns daily task completion counts across ALL users within a date range. Zero-filled per day. All dates UTC. Max range: 365 days. Requires Admin role.',
  security: adminSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'System-wide completion statistics by day',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              byDay: z.array(z.object({
                date: z.string().openapi({ example: '2026-04-15' }),
                count: z.number().openapi({ example: 25 }),
              })),
              total: z.number().openapi({ example: 380 }),
            }),
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
  method: 'get',
  path: '/api/admin/analytics/trends',
  tags: ['Admin Analytics'],
  summary: 'Get system-wide creation and completion trends (admin)',
  description: 'Returns daily counts of tasks created and completed across ALL users within a date range. Zero-filled per day. Useful for system-level trend monitoring. All dates UTC. Max range: 365 days. Requires Admin role.',
  security: adminSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'System-wide daily creation and completion trends',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              byDay: z.array(z.object({
                date: z.string().openapi({ example: '2026-04-15' }),
                created: z.number().openapi({ example: 12 }),
                completed: z.number().openapi({ example: 8 }),
              })),
            }),
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
  method: 'get',
  path: '/api/admin/analytics/time',
  tags: ['Admin Analytics'],
  summary: 'Get system-wide time tracking stats (admin)',
  description: 'Returns total tracked time across ALL users within a date range. Only stopped sessions (with stoppedAt) are counted. Duration in seconds. Requires Admin role.',
  security: adminSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'System-wide time tracking statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              summary: z.object({
                totalDurationSeconds: z.number().openapi({ example: 432000 }),
                sessionCount: z.number().openapi({ example: 150 }),
                averageSessionSeconds: z.number().nullable().openapi({ example: 2880 }),
              }),
            }),
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
  method: 'get',
  path: '/api/admin/analytics/heatmap',
  tags: ['Admin Analytics'],
  summary: 'Get system-wide activity heatmap (admin)',
  description: 'Returns a 7×24 heatmap (168 buckets, always) of task creation and completion activity across ALL users. dayOfWeek: 0=Sunday, 6=Saturday. All times UTC. Always zero-filled. Peak values are null when the entire heatmap is zero. Max range: 365 days. Requires Admin role.',
  security: adminSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'System-wide heatmap with 168 buckets (dayOfWeek × hour)',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              heatmap: z.array(HeatmapBucketSchema).openapi({ description: 'Always 168 entries, ordered dayOfWeek ASC then hour ASC' }),
              summary: HeatmapSummarySchema,
            }),
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
  method: 'get',
  path: '/api/admin/analytics/departments',
  tags: ['Admin Analytics'],
  summary: 'List departments with analytics overview (admin)',
  description: 'Returns a paginated list of departments with basic task statistics for each. Useful for comparing department productivity. Requires Admin role.',
  security: adminSecurity,
  request: { query: departmentListQuerySchema },
  responses: {
    200: {
      description: 'Paginated department analytics list',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
                totalPages: z.number(),
              }),
              departments: z.array(z.object({
                id: z.string().uuid(),
                name: z.string().openapi({ example: 'Engineering' }),
                memberCount: z.number().openapi({ example: 8 }),
                total: z.number().openapi({ example: 45 }),
                todo: z.number().openapi({ example: 10 }),
                doing: z.number().openapi({ example: 8 }),
                done: z.number().openapi({ example: 27 }),
                overdue: z.number().openapi({ example: 2 }),
              })),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/analytics/departments/{departmentId}/summary',
  tags: ['Admin Analytics'],
  summary: 'Get task summary for a department (admin)',
  description: 'Returns detailed task statistics for a specific department across ALL members. Admin can access any department regardless of membership. All data UTC. Requires Admin role.',
  security: adminSecurity,
  request: { params: departmentIdParamSchema },
  responses: {
    200: {
      description: 'Department task summary (admin view)',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              total: z.number(),
              todo: z.number(),
              doing: z.number(),
              done: z.number(),
              overdue: z.number(),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});
