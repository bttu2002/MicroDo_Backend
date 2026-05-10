import { Profile as PrismaProfile } from '@prisma/client';
import { ProfileResponseDTO } from './types';

export const toProfileDTOFromMongo = (user: any): ProfileResponseDTO => {
  return {
    _id: user._id.toString(),
    name: user.name || null,
    email: user.email,
    avatar: user.avatar || null,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
};

export const toProfileDTOFromPrisma = (profile: PrismaProfile): ProfileResponseDTO => {
  return {
    _id: profile.id, // Map UUID to _id
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    role: profile.role,
    status: profile.status,
    createdAt: profile.createdAt,
  };
};

export const toProfileDTOListFromMongo = (users: any[]): ProfileResponseDTO[] => {
  return users.map(toProfileDTOFromMongo);
};

export const toProfileDTOListFromPrisma = (profiles: PrismaProfile[]): ProfileResponseDTO[] => {
  return profiles.map(toProfileDTOFromPrisma);
};
