import { z } from 'zod';

const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const startSessionBodySchema = z.object({
  taskId: z.string().uuid('Invalid taskId'),
});

export const sessionListQuerySchema = z
  .object({
    startDate: z.string().regex(DATE_RE, 'startDate must be YYYY-MM-DD'),
    endDate:   z.string().regex(DATE_RE, 'endDate must be YYYY-MM-DD'),
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((data, ctx) => {
    const startMs = Date.parse(`${data.startDate}T00:00:00.000Z`);
    const endMs   = Date.parse(`${data.endDate}T00:00:00.000Z`);

    if (isNaN(startMs)) {
      ctx.addIssue({ code: 'custom', message: 'startDate is not a valid date', path: ['startDate'] });
      return;
    }
    if (isNaN(endMs)) {
      ctx.addIssue({ code: 'custom', message: 'endDate is not a valid date', path: ['endDate'] });
      return;
    }
    if (data.startDate > data.endDate) {
      ctx.addIssue({ code: 'custom', message: 'startDate must be <= endDate', path: ['startDate'] });
    }
    if (endMs - startMs > 365 * MS_PER_DAY) {
      ctx.addIssue({ code: 'custom', message: 'Date range cannot exceed 365 days', path: ['endDate'] });
    }
  });

export type StartSessionBody = z.infer<typeof startSessionBodySchema>;
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;
