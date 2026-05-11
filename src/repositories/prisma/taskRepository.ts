import { Prisma, Task } from '@prisma/client';
import prisma from '../../config/prisma';
import {
  ITaskRepository,
  CreateTaskData,
  UpdateTaskData,
  FindManyPaginatedOptions,
  PaginatedTasksResult,
  TaskStatsResult,
} from '../interfaces';
import { isUUID } from '../../utils/compatibility';

export class PrismaTaskRepository implements ITaskRepository {

  // ─────────────────────────────────────────────────
  // SINGLE RECORD
  // ─────────────────────────────────────────────────

  async findById(id: string): Promise<Task | null> {
    return prisma.task.findUnique({ where: { id } });
  }

  /**
   * Hybrid lookup: supports both Prisma UUID and legacy MongoDB ObjectId.
   * During Phase 3 cut-over, frontend URLs may still contain Mongo _id strings.
   * This method ensures those requests resolve correctly without breaking.
   */
  async findByIdOrMongoId(id: string): Promise<Task | null> {
    if (isUUID(id)) {
      return prisma.task.findUnique({ where: { id } });
    }
    // Fallback: treat as mongoId (legacy Mongo _id hex string)
    return prisma.task.findUnique({ where: { mongoId: id } });
  }

  // ─────────────────────────────────────────────────
  // COLLECTION
  // ─────────────────────────────────────────────────

  async findByProfile(profileId: string): Promise<Task[]> {
    return prisma.task.findMany({ where: { profileId } });
  }

  /**
   * Production-grade paginated query with:
   * - Filtering  : status, priority, tag, search (case-insensitive)
   * - Sorting    : deadline | createdAt | priority | status | title, asc | desc
   * - Pagination : page + limit with safe bounds
   */
  async findManyPaginated(options: FindManyPaginatedOptions): Promise<PaginatedTasksResult> {
    const { profileId, filter = {}, sort = {}, pagination = {} } = options;

    // ── Pagination bounds ──
    const page  = Math.max(1, pagination.page  ?? 1);
    const limit = Math.min(50, Math.max(1, pagination.limit ?? 10));
    const skip  = (page - 1) * limit;

    // ── Build WHERE clause ──
    const where: Prisma.TaskWhereInput = { profileId };

    if (filter.status) {
      where.status = filter.status as Prisma.EnumTaskStatusFilter;
    }

    if (filter.priority) {
      where.priority = filter.priority as Prisma.EnumTaskPriorityFilter;
    }

    if (filter.tag) {
      // Prisma array contains: checks if tags array includes the value
      where.tags = { has: filter.tag };
    }

    if (filter.search) {
      // Case-insensitive partial match — equivalent to Mongo $regex with 'i'
      where.title = {
        contains: filter.search,
        mode: 'insensitive',
      };
    }

    // ── Build ORDER BY clause ──
    const validSortFields = ['deadline', 'createdAt', 'priority', 'status', 'title'] as const;
    const sortField = validSortFields.includes(sort.sortBy as typeof validSortFields[number])
      ? sort.sortBy!
      : 'createdAt'; // Default sort: newest first

    const sortOrder: Prisma.SortOrder = sort.order === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.TaskOrderByWithRelationInput = { [sortField]: sortOrder };

    // ── Execute queries in parallel ──
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy, skip, take: limit }),
      prisma.task.count({ where }),
    ]);

    return { tasks, total, page, limit };
  }

  // ─────────────────────────────────────────────────
  // WRITE
  // ─────────────────────────────────────────────────

  async create(data: CreateTaskData): Promise<Task> {
    return prisma.task.create({ data });
  }

  async update(id: string, data: UpdateTaskData): Promise<Task> {
    return prisma.task.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────────
  // AGGREGATION
  // ─────────────────────────────────────────────────

  async count(profileId: string): Promise<number> {
    return prisma.task.count({ where: { profileId } });
  }

  /**
   * Replaces MongoDB $group aggregation pipeline.
   * Groups tasks by status and returns counts per status + total.
   */
  async statsByStatus(profileId: string): Promise<TaskStatsResult> {
    const groups = await prisma.task.groupBy({
      by: ['status'],
      where: { profileId },
      _count: { status: true },
    });

    const result: TaskStatsResult = { total: 0, todo: 0, doing: 0, done: 0 };

    for (const g of groups) {
      const count = g._count.status;
      if (g.status === 'todo')  result.todo  = count;
      if (g.status === 'doing') result.doing = count;
      if (g.status === 'done')  result.done  = count;
      result.total += count;
    }

    return result;
  }
}
