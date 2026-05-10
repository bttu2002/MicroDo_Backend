export interface TaskResponseDTO {
  _id: string; // Crucial for frontend compatibility
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  deadline: Date | null;
  userId: string; // Maintain 'userId' for frontend, even if it's 'profileId' in Prisma
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileResponseDTO {
  _id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  role: string;
  status: string;
  createdAt: Date;
}

export interface PaginationResponseDTO {
  currentPage: number;
  totalPages: number;
  totalTasks?: number; // Kept optional depending on entity
  totalUsers?: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
