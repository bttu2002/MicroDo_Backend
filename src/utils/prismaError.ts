import { Prisma } from '@prisma/client';
import { ServiceError } from '../services/departmentService';

export function mapPrismaConflict(err: unknown, message: string): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new ServiceError(message, 409);
  }
  throw err as Error;
}
