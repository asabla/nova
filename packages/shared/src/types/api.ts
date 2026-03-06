export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CursorResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ path: string; message: string }>;
}
