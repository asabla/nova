import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatDistanceToNow } from "date-fns";

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const queryClient = useQueryClient();

  const { data: notificationsData } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api.get<any>("/api/notifications?limit=20"),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const notifications = (notificationsData as any)?.data ?? [];

  if (!open) return null;

  return (
    <div className="fixed right-4 top-14 w-80 z-50">
      <div className="bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-text">Notifications</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
            <button onClick={onClose} className="text-text-tertiary hover:text-text p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Bell className="h-8 w-8 text-text-tertiary mb-2" />
              <p className="text-sm text-text-tertiary">No notifications</p>
            </div>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-surface-secondary transition-colors cursor-pointer ${
                  !n.isRead ? "bg-primary/5" : ""
                }`}
                onClick={() => !n.isRead && markRead.mutate(n.id)}
              >
                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? "bg-transparent" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text">{n.title}</p>
                  <p className="text-xs text-text-tertiary mt-0.5 truncate">{n.body}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">
                    {n.createdAt && formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
