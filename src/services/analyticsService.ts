import * as analyticsRepo from '../repositories/prisma/analyticsRepository';
import type { UserSummaryData, AdminSummaryData } from '../repositories/prisma/analyticsRepository';

export type { UserSummaryData, AdminSummaryData };

export async function getUserSummary(profileId: string): Promise<UserSummaryData> {
  return analyticsRepo.getUserSummary(profileId);
}

export async function getAdminSummary(): Promise<AdminSummaryData> {
  return analyticsRepo.getAdminSummary();
}
