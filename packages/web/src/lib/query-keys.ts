import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export const queryKeys = {
  conversations: {
    all: ["conversations"] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.conversations.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.conversations.all, "detail", id] as const,
    messages: (id: string) => [...queryKeys.conversations.all, "messages", id] as const,
    artifacts: (id: string) => [...queryKeys.conversations.all, "artifacts", id] as const,
  },
  agents: {
    all: ["agents"] as const,
    list: () => [...queryKeys.agents.all, "list"] as const,
    detail: (id: string) => [...queryKeys.agents.all, "detail", id] as const,
  },
  knowledge: {
    all: ["knowledge"] as const,
    list: () => [...queryKeys.knowledge.all, "list"] as const,
    detail: (id: string) => [...queryKeys.knowledge.all, "detail", id] as const,
  },
  workspaces: {
    all: ["workspaces"] as const,
    list: () => [...queryKeys.workspaces.all, "list"] as const,
    detail: (id: string) => [...queryKeys.workspaces.all, "detail", id] as const,
  },
  files: {
    all: ["files"] as const,
    list: () => [...queryKeys.files.all, "list"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => [...queryKeys.notifications.all, "list"] as const,
    unreadCount: () => [...queryKeys.notifications.all, "unread"] as const,
  },
  domains: {
    all: ["domains"] as const,
    list: () => [...queryKeys.domains.all, "list"] as const,
  },
  user: {
    profile: () => ["user", "profile"] as const,
    sessions: () => ["user", "sessions"] as const,
  },
};

export function conversationListOptions(filters?: Record<string, unknown>) {
  return queryOptions({
    queryKey: queryKeys.conversations.list(filters),
    queryFn: () => api.get<any>(`/api/conversations?${new URLSearchParams(filters as any).toString()}`),
    staleTime: 30_000,
  });
}

export function conversationDetailOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => api.get<any>(`/api/conversations/${id}`),
    staleTime: 30_000,
  });
}

export function messagesOptions(conversationId: string) {
  return queryOptions({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: () => api.get<any>(`/api/conversations/${conversationId}/messages`),
    staleTime: 10_000,
  });
}

export function artifactsOptions(conversationId: string) {
  return queryOptions({
    queryKey: queryKeys.conversations.artifacts(conversationId),
    queryFn: () => api.get<any>(`/api/conversations/${conversationId}/artifacts`),
    staleTime: 10_000,
  });
}

export function notificationUnreadCountOptions() {
  return queryOptions({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => api.get<{ count: number }>(`/api/notifications/unread-count`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
