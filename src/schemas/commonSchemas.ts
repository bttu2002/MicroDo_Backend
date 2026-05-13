import { z } from 'zod';

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
export type UuidParam = z.infer<typeof uuidParamSchema>;

export const commentIdParamSchema = z.object({
  commentId: z.string().uuid('Invalid comment ID format'),
});
export type CommentIdParam = z.infer<typeof commentIdParamSchema>;
