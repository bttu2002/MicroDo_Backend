import { Profile, Department, Task } from '@prisma/client';

// ─── DTO Types ───────────────────────────────────────────────

export interface CreateProfileData {
  email: string;
  name?: string;
  avatar?: string;
  passwordHash: string;
  role?: 'USER' | 'ADMIN' | 'DEPT_MANAGER' | 'DEPT_MEMBER';
  mongoId?: string;
}

export interface UpdateProfileData {
  name?: string;
  avatar?: string;
  role?: 'USER' | 'ADMIN' | 'DEPT_MANAGER' | 'DEPT_MEMBER';
  status?: 'ACTIVE' | 'BANNED';
  departmentId?: string | null;
  passwordHash?: string;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
}

export interface CreateDepartmentData {
  name: string;
  description?: string;
}

export interface UpdateDepartmentData {
  name?: string;
  description?: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: 'TODO' | 'DOING' | 'DONE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  tags?: string[];
  deadline?: Date;
  profileId: string;
  departmentId?: string;
  mongoId?: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: 'TODO' | 'DOING' | 'DONE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  tags?: string[];
  deadline?: Date | null;
  departmentId?: string | null;
}

// ─── Department with members (for queries that include relations) ───

export interface DepartmentWithMembers extends Department {
  members: Profile[];
  _count?: {
    members: number;
    tasks: number;
  };
}

// ─── Repository Interfaces ──────────────────────────────────

export interface IProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findByEmail(email: string): Promise<Profile | null>;
  findByMongoId(mongoId: string): Promise<Profile | null>;
  create(data: CreateProfileData): Promise<Profile>;
  update(id: string, data: UpdateProfileData): Promise<Profile>;
}

export interface IDepartmentRepository {
  // ── Read ──
  findById(id: string): Promise<Department | null>;
  findByName(name: string): Promise<Department | null>;
  findAll(): Promise<Department[]>;
  findWithMembers(id: string): Promise<DepartmentWithMembers | null>;
  findAllWithCount(): Promise<DepartmentWithMembers[]>;

  // ── Write ──
  create(data: CreateDepartmentData): Promise<Department>;
  update(id: string, data: UpdateDepartmentData): Promise<Department>;
  delete(id: string): Promise<Department>;

  // ── Member management ──
  addMember(departmentId: string, profileId: string): Promise<Profile>;
  removeMember(profileId: string): Promise<Profile>;
  getMemberCount(departmentId: string): Promise<number>;
  clearAllMembers(departmentId: string): Promise<number>;
}

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProfile(profileId: string): Promise<Task[]>;
  create(data: CreateTaskData): Promise<Task>;
  update(id: string, data: UpdateTaskData): Promise<Task>;
  delete(id: string): Promise<void>;
}
