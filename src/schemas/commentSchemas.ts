import { z } from 'zod';

export const createCommentSchema = z.object({
  content:  z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'Comment cannot exceed 5000 characters'),
  parentId: z.string().uuid('Invalid parentId').optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'Comment cannot exceed 5000 characters'),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const getCommentsQuerySchema = z.object({
  page:  z.coerce.number().int().positive().max(10000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type GetCommentsQuery = z.infer<typeof getCommentsQuerySchema>;
