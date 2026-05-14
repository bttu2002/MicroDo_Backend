import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import { getNotificationsQuerySchema } from '../../schemas/notificationSchemas';

const NotificationSchema = z.object({
  id: z.string().uuid().openapi({ example: 'notif-uuid-1234' }),
  profileId: z.string().uuid(),
  type: z.string().openapi({ example: 'TASK_ASSIGNED' }),
  title: z.string().openapi({ example: 'Task assigned to you' }),
  body: z.string().openapi({ example: 'You have been assigned a new task.' }),
  isRead: z.boolean().openapi({ example: false }),
  metadata: z.object({}).passthrough().nullable(),
  createdAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
}).openapi('Notification');

const notifIdParam = z.object({
  id: z.string().uuid().openapi({ example: 'notif-uuid-1234' }),
});

registry.registerPath({
  method: 'get',
  path: '/api/notifications',
  tags: ['Notifications'],
  summary: 'Get notifications for the current user',
  description: 'Returns a paginated list of notifications for the authenticated user. Filter by unread=true to get only unread notifications. Requires User or Admin role.',
  security: bearerSecurity,
  request: { query: getNotificationsQuerySchema },
  responses: {
    200: {
      description: 'Paginated notification list',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            count: z.number().openapi({ example: 5 }),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
            data: z.array(NotificationSchema),
          }),
        },
      },
    },
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/notifications/unread-count',
  tags: ['Notifications'],
  summary: 'Get unread notification count',
  description: 'Returns the number of unread notifications for the authenticated user. Useful for badge indicators. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'Unread notification count',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              count: z.number().openapi({ example: 7 }),
            }),
          }),
        },
      },
    },
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/notifications/read-all',
  tags: ['Notifications'],
  summary: 'Mark all notifications as read',
  description: 'Marks all unread notifications as read for the authenticated user. Returns the count of notifications updated. Requires User or Admin role.',
  security: bearerSecurity,
  responses: {
    200: {
      description: 'All notifications marked as read',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: '5 notifications marked as read' }),
            data: z.object({ count: z.number().openapi({ example: 5 }) }),
          }),
        },
      },
    },
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/notifications/{id}/read',
  tags: ['Notifications'],
  summary: 'Mark a notification as read',
  description: 'Marks a single notification as read. The authenticated user must own the notification. Requires User or Admin role.',
  security: bearerSecurity,
  request: { params: notifIdParam },
  responses: {
    200: {
      description: 'Notification marked as read',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Notification marked as read' }),
            data: NotificationSchema,
          }),
        },
      },
    },
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});
