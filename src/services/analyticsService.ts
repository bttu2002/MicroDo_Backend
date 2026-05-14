import * as analyticsRepo from '../repositories/prisma/analyticsRepository';
import type {
  UserSummaryData,
  AdminSummaryData,
  UserCompletionData,
  AdminCompletionData,
} from '../repositories/prisma/analyticsRepository';

export type { UserSummaryData, AdminSummaryData, UserCompletionData, AdminCompletionData };

export async function getUserSummary(profileId: string): Promise<UserSummaryData> {
  return analyticsRepo.getUserSummary(profileId);
}

export async function getAdminSummary(): Promise<AdminSummaryData> {
  return analyticsRepo.getAdminSummary();
}

export async function getUserCompletionStats(
  profileId: string,
  startDate: string,
  endDate:   string,
): Promise<UserCompletionData> {
  return analyticsRepo.getUserCompletionStats(profileId, startDate, endDate);
}

export async function getAdminCompletionStats(
  startDate: string,
  endDate:   string,
): Promise<AdminCompletionData> {
  return analyticsRepo.getAdminCompletionStats(startDate, endDate);
}
