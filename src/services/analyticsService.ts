import * as analyticsRepo from '../repositories/prisma/analyticsRepository';
import type {
  UserSummaryData,
  AdminSummaryData,
  UserCompletionData,
  AdminCompletionData,
  DeptSummaryData,
  DeptCompletionData,
  AdminDeptSummaryData,
  AdminDeptListData,
  TrendsData,
} from '../repositories/prisma/analyticsRepository';

export type {
  UserSummaryData,
  AdminSummaryData,
  UserCompletionData,
  AdminCompletionData,
  DeptSummaryData,
  DeptCompletionData,
  AdminDeptSummaryData,
  AdminDeptListData,
  TrendsData,
};

export class AnalyticsServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AnalyticsServiceError';
  }
}

async function assertActiveMember(profileId: string, departmentId: string): Promise<void> {
  const { deptExists, isActiveMember } = await analyticsRepo.checkActiveMembership(profileId, departmentId);
  if (!deptExists)     throw new AnalyticsServiceError('Department not found', 404);
  if (!isActiveMember) throw new AnalyticsServiceError('Not an active member of this department', 403);
}

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

export async function getUserDeptSummary(
  profileId:    string,
  departmentId: string,
): Promise<DeptSummaryData> {
  await assertActiveMember(profileId, departmentId);
  return analyticsRepo.getDeptSummary(departmentId);
}

export async function getUserDeptCompletionStats(
  profileId:    string,
  departmentId: string,
  startDate:    string,
  endDate:      string,
): Promise<DeptCompletionData> {
  await assertActiveMember(profileId, departmentId);
  return analyticsRepo.getDeptCompletionStats(departmentId, startDate, endDate);
}

export async function getAdminDeptList(page: number, limit: number): Promise<AdminDeptListData> {
  return analyticsRepo.getAdminDeptList(page, limit);
}

export async function getAdminDeptSummary(departmentId: string): Promise<AdminDeptSummaryData> {
  const data = await analyticsRepo.getAdminDeptSummary(departmentId);
  if (data === null) throw new AnalyticsServiceError('Department not found', 404);
  return data;
}

export async function getUserTrends(
  profileId: string,
  startDate: string,
  endDate:   string,
): Promise<TrendsData> {
  return analyticsRepo.getUserTrends(profileId, startDate, endDate);
}

export async function getAdminTrends(
  startDate: string,
  endDate:   string,
): Promise<TrendsData> {
  return analyticsRepo.getAdminTrends(startDate, endDate);
}
