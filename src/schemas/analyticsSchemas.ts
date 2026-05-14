import { z } from 'zod';

const MAX_RANGE_DAYS = 365;
const MS_PER_DAY     = 24 * 60 * 60 * 1000;
const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/;

export const dateRangeQuerySchema = z.object({
  startDate: z.string().regex(DATE_RE, 'startDate must be YYYY-MM-DD'),
  endDate:   z.string().regex(DATE_RE, 'endDate must be YYYY-MM-DD'),
}).superRefine((data, ctx) => {
  const startMs  = Date.parse(`${data.startDate}T00:00:00.000Z`);
  const endMs    = Date.parse(`${data.endDate}T00:00:00.000Z`);
  // Compare dates as YYYY-MM-DD strings (lexicographic order is correct for this format)
  const todayStr = new Date().toISOString().slice(0, 10);

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
  if (data.endDate > todayStr) {
    ctx.addIssue({ code: 'custom', message: 'endDate cannot be in the future', path: ['endDate'] });
  }
  if (endMs - startMs > MAX_RANGE_DAYS * MS_PER_DAY) {
    ctx.addIssue({ code: 'custom', message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`, path: ['endDate'] });
  }
});

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

export const departmentIdParamSchema = z.object({
  departmentId: z.string().uuid('Invalid departmentId'),
});

export const departmentListQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DepartmentIdParam   = z.infer<typeof departmentIdParamSchema>;
export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;
