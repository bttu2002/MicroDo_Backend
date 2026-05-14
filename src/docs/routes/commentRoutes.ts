import { registry, z } from '../registry';
import { bearerSecurity, errorResponses } from '../components';
import { createCommentSchema, updateCommentSchema, getCommentsQuerySchema } from '../../schemas/commentSchemas';

const CommentSchema = z.object({
  _id: z.string().nullable().openapi({ example: null }),
  id: z.string().uuid().openapi({ example: 'comment-uuid-1234' }),
  taskId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().openapi({ example: 'Great work on this task!' }),
  parentId: z.string().uuid().nullable().openapi({ example: null }),
  createdAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-05-14T00:00:00.000Z' }),
  deletedAt: z.string().nullable().openapi({ example: null }),
}).openapi('Comment');

registry.registerPath({
  method: 'get',
  path: '/api/tasks/{taskId}/comments',
  tags: ['Comments'],
  summary: 'Get comments for a task',
  description: 'Returns a paginated list of comments on a task. The authenticated user must own the task or be a member of the department the task belongs to. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    params: z.object({ taskId: z.string().uuid().openapi({ example: 'task-uuid-1234' }) }),
    query: getCommentsQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated comment list',
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
            data: z.array(CommentSchema),
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
  method: 'post',
  path: '/api/tasks/{taskId}/comments',
  tags: ['Comments'],
  summary: 'Create a comment on a task',
  description: 'Adds a new comment to a task. Supports threaded replies via parentId. The authenticated user must have access to the task. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    params: z.object({ taskId: z.string().uuid().openapi({ example: 'task-uuid-1234' }) }),
    body: {
      required: true,
      content: { 'application/json': { schema: createCommentSchema } },
    },
  },
  responses: {
    201: {
      description: 'Comment created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Comment created successfully' }),
            data: CommentSchema,
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

registry.registerPath({
  method: 'patch',
  path: '/api/comments/{commentId}',
  tags: ['Comments'],
  summary: 'Update a comment',
  description: 'Updates the content of an existing comment. Only the comment author can edit it. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    params: z.object({ commentId: z.string().uuid().openapi({ example: 'comment-uuid-1234' }) }),
    body: {
      required: true,
      content: { 'application/json': { schema: updateCommentSchema } },
    },
  },
  responses: {
    200: {
      description: 'Comment updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Comment updated successfully' }),
            data: CommentSchema,
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

registry.registerPath({
  method: 'delete',
  path: '/api/comments/{commentId}',
  tags: ['Comments'],
  summary: 'Delete a comment',
  description: 'Soft-deletes a comment (marks as deleted). Only the comment author can delete it. Requires User or Admin role.',
  security: bearerSecurity,
  request: {
    params: z.object({ commentId: z.string().uuid().openapi({ example: 'comment-uuid-1234' }) }),
  },
  responses: {
    200: {
      description: 'Comment deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            message: z.string().openapi({ example: 'Comment deleted successfully' }),
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
