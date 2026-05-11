/**
 * PaginationDTO
 *
 * Canonical pagination metadata shape returned to the frontend.
 * Mirrors the existing MongoDB pagination response exactly so that
 * frontend pagination logic requires zero changes.
 */
export interface PaginationDTO {
  currentPage: number;
  totalPages: number;
  totalTasks: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * PaginatedTasksResponseDTO
 *
 * Full paginated tasks response shape — wraps tasks list + pagination metadata.
 */
export interface PaginatedTasksResponseDTO {
  success: true;
  count: number;
  pagination: PaginationDTO;
  data: import('./taskResponse.dto').TaskResponseDTO[];
}
