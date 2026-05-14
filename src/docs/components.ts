import { registry, z } from './registry';

// ─── Security Scheme ──────────────────────────────────────────
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT token obtained from /api/auth/login',
});

// ─── Reusable Error Schemas ───────────────────────────────────
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
  message: z.string().openapi({ example: 'Validation failed' }),
  requestId: z.string().optional().openapi({ example: 'abc-123-def' }),
}).openapi('ErrorResponse');

export const ValidationErrorSchema = z.object({
  success: z.literal(false),
  code: z.literal('VALIDATION_ERROR'),
  message: z.string().openapi({ example: 'Validation failed' }),
  requestId: z.string().optional(),
  errors: z.array(z.object({
    field: z.string().openapi({ example: 'email' }),
    message: z.string().openapi({ example: 'Invalid email address' }),
  })).optional(),
}).openapi('ValidationErrorResponse');

// ─── Common Reusable Response Helpers ────────────────────────
export const PaginationSchema = z.object({
  page: z.number().openapi({ example: 1 }),
  limit: z.number().openapi({ example: 20 }),
  total: z.number().openapi({ example: 100 }),
  totalPages: z.number().openapi({ example: 5 }),
}).openapi('Pagination');

// ─── Reusable Response Builders ──────────────────────────────
export const errorResponses = {
  400: {
    description: 'Bad Request — validation error',
    content: { 'application/json': { schema: ValidationErrorSchema } },
  },
  401: {
    description: 'Unauthorized — missing or invalid JWT token',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  403: {
    description: 'Forbidden — insufficient permissions',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  404: {
    description: 'Not Found — resource does not exist',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  409: {
    description: 'Conflict — resource already exists or state mismatch',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  429: {
    description: 'Too Many Requests — rate limit exceeded',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
  500: {
    description: 'Internal Server Error',
    content: { 'application/json': { schema: ErrorResponseSchema } },
  },
} as const;

export const bearerSecurity: { [key: string]: string[] }[] = [{ bearerAuth: [] }];
