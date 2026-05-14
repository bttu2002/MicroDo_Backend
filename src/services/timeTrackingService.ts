import * as timeTrackingRepo from '../repositories/prisma/timeTrackingRepository';
import type { TimeSession, SessionListData } from '../repositories/prisma/timeTrackingRepository';

export type { TimeSession, SessionListData };

export class TimeTrackingServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'TimeTrackingServiceError';
  }
}

export async function startSession(profileId: string, taskId: string): Promise<TimeSession> {
  const owned = await timeTrackingRepo.checkTaskOwnership(profileId, taskId);
  if (!owned) throw new TimeTrackingServiceError('Task not found', 404);

  const active = await timeTrackingRepo.findActiveSession(profileId);
  if (active !== null) throw new TimeTrackingServiceError('A session is already active', 409);

  return timeTrackingRepo.createSession(profileId, taskId);
}

export async function stopSession(profileId: string): Promise<TimeSession> {
  const session = await timeTrackingRepo.stopActiveSession(profileId);
  if (session === null) throw new TimeTrackingServiceError('No active session found', 404);
  return session;
}

export async function getActiveSession(profileId: string): Promise<TimeSession | null> {
  return timeTrackingRepo.findActiveSession(profileId);
}

export async function listSessions(
  profileId: string,
  startDate: string,
  endDate:   string,
  page:      number,
  limit:     number,
): Promise<SessionListData> {
  return timeTrackingRepo.listSessions(profileId, startDate, endDate, page, limit);
}
