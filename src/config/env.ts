import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5173')
    .transform(val => val.split(',').map(u => u.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  process.stderr.write(`\n[FATAL] Invalid environment configuration:\n${issues}\n\n`);
  process.exit(1);
}

export const env: Env = result.data;
