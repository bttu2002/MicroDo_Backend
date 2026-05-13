import { z } from 'zod';

export const createTaskSchema = z.object({
  title:        z.string().trim().min(1, 'Title is required').max(255),
  description:  z.string().trim().max(5000).optional(),
  status:       z.enum(['todo', 'doing', 'done']).optional(),
  priority:     z.enum(['low', 'medium', 'high']).optional(),
  tags:         z.array(z.string().trim()).optional(),
  deadline:     z.string().datetime({ offset: true }).nullable().optional(),
  departmentId: z.string().uuid('Invalid departmentId').optional(),
});
export type CreateTaskBody = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title:       z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional(),
  status:      z.enum(['todo', 'doing', 'done']).optional(),
  priority:    z.enum(['low', 'medium', 'high']).optional(),
  tags:        z.array(z.string().trim()).optional(),
  deadline:    z.string().datetime({ offset: true }).nullable().optional(),
});
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;

export const getTasksQuerySchema = z.object({
  page:     z.coerce.number().int().positive().max(10000).default(1),
  limit:    z.coerce.number().int().positive().max(100).default(10),
  status:   z.enum(['todo', 'doing', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  search:   z.string().trim().optional(),
  tag:      z.string().trim().optional(),
  sortBy:   z.enum(['deadline', 'createdAt', 'priority', 'status', 'title']).optional(),
  order:    z.enum(['asc', 'desc']).optional(),
});
export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;
