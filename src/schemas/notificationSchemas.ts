import { z } from 'zod';

export const getNotificationsQuerySchema = z.object({
  page:   z.coerce.number().int().positive().max(1000).default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
  unread: z.string().optional().transform(v => v === 'true'),
});
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;
