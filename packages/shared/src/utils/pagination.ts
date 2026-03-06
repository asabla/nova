import { DEFAULTS } from "../constants/defaults";

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult {
  offset: number;
  limit: number;
  page: number;
  pageSize: number;
}

export function parsePagination(input: PaginationInput): PaginationResult {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    DEFAULTS.PAGINATION_MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULTS.PAGINATION_PAGE_SIZE),
  );
  return {
    offset: (page - 1) * pageSize,
    limit: pageSize,
    page,
    pageSize,
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationResult,
) {
  return {
    data,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasMore: pagination.offset + data.length < total,
  };
}
