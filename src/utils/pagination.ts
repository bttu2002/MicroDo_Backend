export const MAX_PAGINATION_SKIP = 100_000;

export function buildSkip(page: number, limit: number): number {
  return Math.min((page - 1) * limit, MAX_PAGINATION_SKIP);
}
