import { z } from 'zod';

export const updateProfileSchema = z.object({
  name:     z.string().trim().min(1).max(100).optional(),
  email:    z.string().email('Invalid email address').optional(),
  avatar:   z.string().max(2048).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^\w{3,30}$/, 'Username must be 3–30 characters and contain only letters, numbers, or underscores')
    .optional(),
  jobTitle: z.string().trim().max(200).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
