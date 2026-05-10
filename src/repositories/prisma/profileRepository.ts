import prisma from '../../config/prisma';
import {
  IProfileRepository,
  CreateProfileData,
  UpdateProfileData,
} from '../interfaces';
import { Profile } from '@prisma/client';

export class PrismaProfileRepository implements IProfileRepository {
  async findById(id: string): Promise<Profile | null> {
    return prisma.profile.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<Profile | null> {
    return prisma.profile.findUnique({ where: { email } });
  }

  async findByMongoId(mongoId: string): Promise<Profile | null> {
    return prisma.profile.findUnique({ where: { mongoId } });
  }

  async create(data: CreateProfileData): Promise<Profile> {
    return prisma.profile.create({ data });
  }

  async update(id: string, data: UpdateProfileData): Promise<Profile> {
    return prisma.profile.update({
      where: { id },
      data,
    });
  }
}

