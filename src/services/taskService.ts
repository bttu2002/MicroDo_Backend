import { Task, Profile } from '@prisma/client';
import {
  ITaskRepository,
  IProfileRepository,
  UpdateTaskData,
  TaskFilterOptions,
  TaskSortOptions,
  TaskPaginationOptions,
} from '../repositories/interfaces';
import { buildScopedTaskFilter } from '../utils/taskQueryBuilder';
import { mapPrismaTaskToResponseDTO } from '../dto/task/taskMapper';
import { TaskResponseDTO } from '../dto/task/taskResponse.dto';
import { PaginatedTasksResponseDTO, PaginationDTO } from '../dto/task/pagination.dto';

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: 'todo' | 'doing' | 'done';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  deadline?: Date | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: 'todo' | 'doing' | 'done';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  deadline?: Date | null;
}

export interface GetTasksInput {
  status?: string;
  priority?: string;
  search?: string;
  tag?: string;
  page?: number;
  limit?: number;
  sortBy?: 'deadline' | 'createdAt' | 'priority' | 'status' | 'title';
  order?: 'asc' | 'desc';
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class TaskServiceError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'TaskServiceError';
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class TaskService {
  constructor(
    private readonly taskRepo: ITaskRepository,
    private readonly profileRepo: IProfileRepository
  ) {}

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async resolveProfileByMongoUserId(mongoUserId: string): Promise<Profile> {
    const profile = await this.profileRepo.findByMongoId(mongoUserId);
    if (!profile) {
      throw new TaskServiceError('User profile not found in new system', 404);
    }
    return profile;
  }

  private validateTaskOwnership(task: Task, profile: Profile): void {
    if (task.profileId !== profile.id) {
      throw new TaskServiceError('Not authorized to access this task', 403);
    }
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async createTask(mongoUserId: string, input: CreateTaskInput): Promise<TaskResponseDTO> {
    if (!input.title?.trim()) {
      throw new TaskServiceError('Title is required', 400);
    }

    const profile = await this.resolveProfileByMongoUserId(mongoUserId);

    const task = await this.taskRepo.create({
      title:       input.title.trim(),
      description: input.description ?? '',
      status:      input.status      ?? 'todo',
      priority:    input.priority    ?? 'medium',
      tags:        input.tags        ?? [],
      profileId:   profile.id,
      ...(input.deadline != null && { deadline: input.deadline }),
    });

    return mapPrismaTaskToResponseDTO({ ...task, profile });
  }

  // ─── Read (list) ──────────────────────────────────────────────────────────

  async getTasks(mongoUserId: string, query: GetTasksInput): Promise<PaginatedTasksResponseDTO> {
    const profile     = await this.resolveProfileByMongoUserId(mongoUserId);
    const scopeFilter = buildScopedTaskFilter(mongoUserId, profile.departmentId, profile.role);

    const filter: TaskFilterOptions = {};
    if (query.status)   filter.status   = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.search)   filter.search   = query.search;
    if (query.tag)      filter.tag      = query.tag;

    const sort: TaskSortOptions = {};
    if (query.sortBy) sort.sortBy = query.sortBy;
    if (query.order)  sort.order  = query.order;

    const paginationOpts: TaskPaginationOptions = {};
    if (query.page)  paginationOpts.page  = query.page;
    if (query.limit) paginationOpts.limit = query.limit;

    const result = await this.taskRepo.findManyPaginated({
      profileId:  profile.id,
      filter,
      sort,
      pagination: paginationOpts,
      scopeFilter,
    });

    const totalPages = Math.ceil(result.total / result.limit);

    const pagination: PaginationDTO = {
      currentPage: result.page,
      totalPages,
      totalTasks:  result.total,
      limit:       result.limit,
      hasNextPage: result.page < totalPages,
      hasPrevPage: result.page > 1,
    };

    const data = result.tasks.map(task => mapPrismaTaskToResponseDTO({ ...task, profile }));

    return { success: true, count: data.length, pagination, data };
  }

  // ─── Read (single) ────────────────────────────────────────────────────────

  async getTaskById(mongoUserId: string, taskId: string): Promise<TaskResponseDTO> {
    const task = await this.taskRepo.findByIdOrMongoId(taskId);
    if (!task) {
      throw new TaskServiceError('Task not found', 404);
    }

    const profile = await this.resolveProfileByMongoUserId(mongoUserId);
    this.validateTaskOwnership(task, profile);

    return mapPrismaTaskToResponseDTO({ ...task, profile });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateTask(
    mongoUserId: string,
    taskId: string,
    input: UpdateTaskInput
  ): Promise<TaskResponseDTO> {
    const task = await this.taskRepo.findByIdOrMongoId(taskId);
    if (!task) {
      throw new TaskServiceError('Task not found', 404);
    }

    const profile = await this.resolveProfileByMongoUserId(mongoUserId);
    this.validateTaskOwnership(task, profile);

    const data: UpdateTaskData = {};
    if (input.title       !== undefined) data.title       = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.status      !== undefined) data.status      = input.status;
    if (input.priority    !== undefined) data.priority    = input.priority;
    if (input.tags        !== undefined) data.tags        = input.tags;
    if (input.deadline    !== undefined) data.deadline    = input.deadline;

    const updated = await this.taskRepo.update(task.id, data);

    return mapPrismaTaskToResponseDTO({ ...updated, profile });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteTask(mongoUserId: string, taskId: string): Promise<void> {
    const task = await this.taskRepo.findByIdOrMongoId(taskId);
    if (!task) {
      throw new TaskServiceError('Task not found', 404);
    }

    const profile = await this.resolveProfileByMongoUserId(mongoUserId);
    this.validateTaskOwnership(task, profile);

    await this.taskRepo.delete(task.id);
  }
}
