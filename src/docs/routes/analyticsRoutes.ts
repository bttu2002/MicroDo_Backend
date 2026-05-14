import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import {
  dateRangeQuerySchema,
  departmentIdParamSchema,
} from '../../schemas/analyticsSchemas';

const dateRangeQuery = z.object({
  startDate: z.string().openapi({ example: '2026-04-01', description: 'Start date in YYYY-MM-DD format (UTC)' }),
  endDate: z.string().openapi({ example: '2026-04-30', description: 'End date in YYYY-MM-DD format (UTC). Cannot be in the future. Max range: 365 days.' }),
});

const PeriodSchema = z.object({
  startDate: z.string().openapi({ example: '2026-04-01' }),
  endDate: z.string().openapi({ example: '2026-04-30' }),
}).openapi('AnalyticsPeriod');

const HeatmapBucketSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).openapi({ description: '0=Sunday, 6=Saturday', example: 1 }),
  hour: z.number().int().min(0).max(23).openapi({ example: 9 }),
  created: z.number().openapi({ example: 3 }),
  completed: z.number().openapi({ example: 2 }),
  total: z.number().openapi({ example: 5 }),
}).openapi('HeatmapBucket');

const HeatmapSummarySchema = z.object({
  peakDayOfWeek: z.number().int().nullable().openapi({ example: 1 }),
  peakHour: z.number().int().nullable().openapi({ example: 10 }),
  totalCreated: z.number().openapi({ example: 48 }),
  totalCompleted: z.number().openapi({ example: 35 }),
}).openapi('HeatmapSummary');

registry.registerPath({
  method: 'get',
  path: '/api/analytics/summary',
  tags: ['Analytics'],
  summary: 'Get task summary for the current user',
  description: 'Returns aggregated task counts grouped by status (todo, doing, done) for the authenticated user. All data is in UTC. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'User task summary',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              total: z.number().openapi({ example: 20 }),
              todo: z.number().openapi({ example: 5 }),
              doing: z.number().openapi({ example: 3 }),
              done: z.number().openapi({ example: 12 }),
              overdue: z.number().openapi({ example: 2 }),
            }),
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
  path: '/api/analytics/completion',
  tags: ['Analytics'],
  summary: 'Get task completion stats for the current user',
  description: 'Returns the number of tasks completed per day within a date range for the authenticated user. Zero-filled — every day in the range appears even with 0 completions. All dates in UTC (YYYY-MM-DD format). Max range: 365 days. Requires User or Admin role.',
  security: bearerSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'Completion statistics by day',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              byDay: z.array(z.object({
                date: z.string().openapi({ example: '2026-04-15' }),
                count: z.number().openapi({ example: 3 }),
              })),
              total: z.number().openapi({ example: 48 }),
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

registry.registerPath({
  method: 'get',
  path: '/api/analytics/trends',
  tags: ['Analytics'],
  summary: 'Get task creation and completion trends for the current user',
  description: 'Returns daily counts of tasks created and completed within a date range. Zero-filled per day. Useful for trend line charts. All dates UTC. Max range: 365 days. Requires User or Admin role.',
  security: bearerSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'Daily creation and completion trend data',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              byDay: z.array(z.object({
                date: z.string().openapi({ example: '2026-04-15' }),
                created: z.number().openapi({ example: 2 }),
                completed: z.number().openapi({ example: 1 }),
              })),
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

registry.registerPath({
  method: 'get',
  path: '/api/analytics/time',
  tags: ['Analytics'],
  summary: 'Get time tracking stats for the current user',
  description: 'Returns total tracked time and a breakdown by task within a date range. Only sessions that have been stopped (with a stoppedAt timestamp) are counted. Duration is in seconds. Requires User or Admin role.',
  security: bearerSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'Time tracking statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              summary: z.object({
                totalDurationSeconds: z.number().openapi({ example: 7200 }),
                sessionCount: z.number().openapi({ example: 5 }),
                averageSessionSeconds: z.number().nullable().openapi({ example: 1440 }),
              }),
              byTask: z.array(z.object({
                taskId: z.string().uuid(),
                title: z.string(),
                totalDurationSeconds: z.number(),
                sessionCount: z.number(),
              })),
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

registry.registerPath({
  method: 'get',
  path: '/api/analytics/heatmap',
  tags: ['Analytics'],
  summary: 'Get activity heatmap for the current user',
  description: 'Returns a 7×24 heatmap (168 buckets, always) of task creation and completion activity by day-of-week and hour in UTC. dayOfWeek: 0=Sunday, 6=Saturday. Always zero-filled — all 168 combinations appear. Peak values are null when the entire heatmap is zero. Max range: 365 days. Requires User or Admin role.',
  security: bearerSecurity,
  request: { query: dateRangeQuery },
  responses: {
    200: {
      description: 'Heatmap with 168 buckets (dayOfWeek × hour)',
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
    429: errorResponses[429],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/analytics/departments/{departmentId}/summary',
  tags: ['Analytics'],
  summary: 'Get task summary for a department (user view)',
  description: 'Returns task summary statistics for a specific department. The authenticated user must be a member of that department. Aggregates across all members. All data UTC. Requires User or Admin role.',
  security: bearerSecurity,
  request: { params: departmentIdParamSchema },
  responses: {
    200: {
      description: 'Department task summary',
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

registry.registerPath({
  method: 'get',
  path: '/api/analytics/departments/{departmentId}/completion',
  tags: ['Analytics'],
  summary: 'Get completion stats for a department (user view)',
  description: 'Returns daily completion counts for all tasks in a department within a date range. The authenticated user must be a member of that department. Zero-filled per day. All dates UTC. Max range: 365 days. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    params: departmentIdParamSchema,
    query: dateRangeQuery,
  },
  responses: {
    200: {
      description: 'Department completion statistics by day',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              timezone: z.literal('UTC'),
              period: PeriodSchema,
              byDay: z.array(z.object({
                date: z.string(),
                count: z.number(),
              })),
              total: z.number(),
            }),
          }),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    429: errorResponses[429],
    500: errorResponses[500],
  },
});
