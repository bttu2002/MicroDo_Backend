import prisma from '../../config/prisma';
import { IProfileRepository } from '../interfaces';
import { Profile } from '@prisma/client';

export class PrismaProfileRepository implements IProfileRepository {
  async findById(id: string): Promise<Profile | null> {
    return prisma.profile.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Profile | null> {
    return prisma.profile.findUnique({ where: { email } });
  }

  async create(data: any): Promise<Profile> {
    return prisma.profile.create({ data });
  }

  async update(id: string, data: any): Promise<Profile> {
    return prisma.profile.update({
      where: { id },
      data,
    });
  }
}
