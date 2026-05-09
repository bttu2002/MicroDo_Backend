import { Profile, Department, Task } from '@prisma/client';

export interface IProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findByEmail(email: string): Promise<Profile | null>;
  create(data: any): Promise<Profile>;
  update(id: string, data: any): Promise<Profile>;
}

export interface IDepartmentRepository {
  findById(id: string): Promise<Department | null>;
  findAll(): Promise<Department[]>;
  create(data: any): Promise<Department>;
}

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findByProfile(profileId: string): Promise<Task[]>;
  create(data: any): Promise<Task>;
  update(id: string, data: any): Promise<Task>;
  delete(id: string): Promise<void>;
}
