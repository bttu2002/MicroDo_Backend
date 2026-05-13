import { z } from 'zod';

export const getNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  unread: z
    .string()
    .optional()
    .transform(v => v === 'true'),
});

export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;
