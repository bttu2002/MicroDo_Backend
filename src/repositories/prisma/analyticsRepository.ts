import prisma from '../../config/prisma';

const DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Date range helpers ───────────────────────────────────────

function toUTCDateRange(startDate: string, endDate: string): { start: Date; end: Date } {
  return {
    start: new Date(`${startDate}T00:00:00.000Z`),
    end:   new Date(`${endDate}T23:59:59.999Z`),
  };
}

interface AvgResult { avg_ms: number | null }

export interface UserSummaryData {
  tasks: {
    total:   number;
    todo:    number;
    doing:   number;
    done:    number;
    overdue: number;
    dueSoon: number;
  };
  notifications: { unread: number };
  comments:      { total: number };
}

export interface AdminSummaryData {
  users: {
    total:  number;
    active: number;
    banned: number;
  };
  tasks: {
    total:        number;
    todo:         number;
    doing:        number;
    done:         number;
    overdue:      number;
    dueSoon:      number;
    createdToday: number;
  };
  departments: { total: number };
  comments:    { total: number };
}

export async function getUserSummary(profileId: string): Promise<UserSummaryData> {
  const now = new Date();
  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_MS);

  const [taskGroups, overdueCount, dueSoonCount, unreadCount, commentCount] =
    await prisma.$transaction([
      prisma.task.groupBy({
        by: ['status'],
        where: { profileId },
        _count: { status: true },
      }),
      prisma.task.count({
        where: {
          profileId,
          status:   { not: 'done' },
          deadline: { lt: now },
        },
      }),
      prisma.task.count({
        where: {
          profileId,
          status:   { not: 'done' },
          deadline: { gte: now, lte: dueSoonCutoff },
        },
      }),
      prisma.notification.count({
        where: { userId: profileId, readAt: null },
      }),
      prisma.comment.count({
        where: { authorId: profileId, deletedAt: null },
      }),
    ]);

  let total = 0, todo = 0, doing = 0, done = 0;
  for (const g of taskGroups) {
    const c = g._count.status;
    total += c;
    if (g.status === 'todo')  todo  = c;
    if (g.status === 'doing') doing = c;
    if (g.status === 'done')  done  = c;
  }

  return {
    tasks:         { total, todo, doing, done, overdue: overdueCount, dueSoon: dueSoonCount },
    notifications: { unread: unreadCount },
    comments:      { total: commentCount },
  };
}

// ─── Completion stats interfaces ─────────────────────────────

export interface UserCompletionData {
  period: { startDate: string; endDate: string };
  tasks: {
    created:                 number;
    completed:               number;
    completionRate:          number;
    averageCompletionTimeMs: number | null;
  };
}

export interface AdminCompletionData {
  period: { startDate: string; endDate: string };
  tasks: {
    created:                 number;
    completed:               number;
    completionRate:          number;
    averageCompletionTimeMs: number | null;
    byStatus: { todo: number; doing: number; done: number };
  };
}

export async function getUserCompletionStats(
  profileId: string,
  startDate: string,
  endDate:   string,
): Promise<UserCompletionData> {
  const { start, end } = toUTCDateRange(startDate, endDate);

  const [createdCount, completedCount] = await prisma.$transaction([
    prisma.task.count({ where: { profileId, createdAt:   { gte: start, lte: end } } }),
    prisma.task.count({ where: { profileId, completedAt: { gte: start, lte: end } } }),
  ]);

  // AVG(completedAt - createdAt) cannot be expressed in Prisma aggregate — use bounded raw query
  const avgRaw = await prisma.$queryRaw<AvgResult[]>`
    SELECT AVG(
      EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000
    ) AS avg_ms
    FROM "tasks"
    WHERE "profileId" = ${profileId}
      AND "completedAt" >= ${start}
      AND "completedAt" <= ${end}
  `;

  const avgRow = avgRaw[0];
  const averageCompletionTimeMs =
    avgRow !== undefined && avgRow.avg_ms !== null
      ? Math.round(Number(avgRow.avg_ms))
      : null;

  const completionRate =
    createdCount > 0
      ? Math.round((completedCount / createdCount) * 10000) / 10000
      : 0;

  return {
    period: { startDate, endDate },
    tasks:  { created: createdCount, completed: completedCount, completionRate, averageCompletionTimeMs },
  };
}

export async function getAdminCompletionStats(
  startDate: string,
  endDate:   string,
): Promise<AdminCompletionData> {
  const { start, end } = toUTCDateRange(startDate, endDate);

  const [createdCount, completedCount, statusGroups] = await prisma.$transaction([
    prisma.task.count({ where: { createdAt:   { gte: start, lte: end } } }),
    prisma.task.count({ where: { completedAt: { gte: start, lte: end } } }),
    prisma.task.groupBy({
      by:    ['status'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { status: true },
    }),
  ]);

  const avgRaw = await prisma.$queryRaw<AvgResult[]>`
    SELECT AVG(
      EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000
    ) AS avg_ms
    FROM "tasks"
    WHERE "completedAt" >= ${start}
      AND "completedAt" <= ${end}
  `;

  const avgRow = avgRaw[0];
  const averageCompletionTimeMs =
    avgRow !== undefined && avgRow.avg_ms !== null
      ? Math.round(Number(avgRow.avg_ms))
      : null;

  const completionRate =
    createdCount > 0
      ? Math.round((completedCount / createdCount) * 10000) / 10000
      : 0;

  let todo = 0, doing = 0, done = 0;
  for (const g of statusGroups) {
    const c = g._count.status;
    if (g.status === 'todo')  todo  = c;
    if (g.status === 'doing') doing = c;
    if (g.status === 'done')  done  = c;
  }

  return {
    period: { startDate, endDate },
    tasks: {
      created:  createdCount,
      completed: completedCount,
      completionRate,
      averageCompletionTimeMs,
      byStatus: { todo, doing, done },
    },
  };
}

export async function getAdminSummary(): Promise<AdminSummaryData> {
  const now = new Date();
  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_MS);
  const todayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));

  const [
    userGroups,
    taskGroups,
    overdueCount,
    dueSoonCount,
    createdTodayCount,
    deptCount,
    commentCount,
  ] = await prisma.$transaction([
    prisma.profile.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.task.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.task.count({
      where: { status: { not: 'done' }, deadline: { lt: now } },
    }),
    prisma.task.count({
      where: { status: { not: 'done' }, deadline: { gte: now, lte: dueSoonCutoff } },
    }),
    prisma.task.count({
      where: { createdAt: { gte: todayUTC } },
    }),
    prisma.department.count(),
    prisma.comment.count({ where: { deletedAt: null } }),
  ]);

  let userTotal = 0, active = 0, banned = 0;
  for (const g of userGroups) {
    const c = g._count.status;
    userTotal += c;
    if (g.status === 'ACTIVE') active = c;
    if (g.status === 'BANNED') banned = c;
  }

  let taskTotal = 0, todo = 0, doing = 0, done = 0;
  for (const g of taskGroups) {
    const c = g._count.status;
    taskTotal += c;
    if (g.status === 'todo')  todo  = c;
    if (g.status === 'doing') doing = c;
    if (g.status === 'done')  done  = c;
  }

  return {
    users:       { total: userTotal, active, banned },
    tasks:       { total: taskTotal, todo, doing, done, overdue: overdueCount, dueSoon: dueSoonCount, createdToday: createdTodayCount },
    departments: { total: deptCount },
    comments:    { total: commentCount },
  };
}
