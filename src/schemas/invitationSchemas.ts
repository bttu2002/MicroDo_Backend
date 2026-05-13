import { z } from 'zod';
import { DepartmentMemberRole } from '@prisma/client';

export const sendInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role:  z.nativeEnum(DepartmentMemberRole).optional(),
});
export type SendInvitationInput = z.infer<typeof sendInvitationSchema>;
