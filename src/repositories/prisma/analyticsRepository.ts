import prisma from '../../config/prisma';

const DUE_SOON_MS = 7 * 24 * 60 * 60 * 1000;

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
