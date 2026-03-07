import type { ProblemDetails } from "@nova/shared/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

/** Org ID stored outside React for use in the API client */
let _activeOrgId: string | null = localStorage.getItem("nova-org-id");

export function setActiveOrgId(orgId: string | null) {
  _activeOrgId = orgId;
  if (orgId) {
    localStorage.setItem("nova-org-id", orgId);
  } else {
    localStorage.removeItem("nova-org-id");
  }
}

export function getActiveOrgId(): string | null {
  return _activeOrgId;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public problem: ProblemDetails,
  ) {
    super(problem.title);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (_activeOrgId) {
    headers["x-org-id"] = _activeOrgId;
  }
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({
      type: "https://nova.dev/errors/unknown",
      title: "Request failed",
      status: response.status,
    }));
    throw new ApiError(response.status, problem);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "GET", headers }),

  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, headers }),

  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, headers }),

  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, headers }),

  delete: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: "DELETE", headers }),
};

/** Returns headers with org ID for raw fetch calls */
export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (_activeOrgId) {
    headers["x-org-id"] = _activeOrgId;
  }
  return headers;
}

export { ApiError };
