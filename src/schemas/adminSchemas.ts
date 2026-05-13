import { z } from 'zod';

export const getUsersQuerySchema = z.object({
  page:   z.coerce.number().int().positive().max(10000).default(1),
  limit:  z.coerce.number().int().positive().max(50).default(10),
  search: z.string().trim().optional(),
});
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
