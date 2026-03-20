import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  AtSign,
  MessageSquare,
  Bot,
  Info,
  AlertTriangle,
  AlertOctagon,
  CheckCheck,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { formatRelativeTime } from "../../lib/format";
import { api } from "../../lib/api";
import { queryKeys, notificationUnreadCountOptions } from "../../lib/query-keys";

// ---- Types ----------------------------------------------------------------

type NotificationType =
  | "mention"
  | "reply"
  | "agent_complete"
  | "system"
  | "rate_limit"
  | "error";

interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  body?: string | null;
  isRead: boolean;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  meta: { total: number; page: number; pageSize: number };
}

// ---- Helpers ---------------------------------------------------------------

const typeConfig: Record<
  NotificationType,
  { icon: typeof Bell; color: string }
> = {
  mention: { icon: AtSign, color: "text-blue-500 bg-blue-500/10" },
  reply: { icon: MessageSquare, color: "text-purple-500 bg-purple-500/10" },
  agent_complete: { icon: Bot, color: "text-success bg-success/10" },
  system: { icon: Info, color: "text-primary bg-primary/10" },
  rate_limit: { icon: AlertTriangle, color: "text-warning bg-warning/10" },
  error: { icon: AlertOctagon, color: "text-danger bg-danger/10" },
};

function getTypeConfig(type: string) {
  return (
    typeConfig[type as NotificationType] ?? {
      icon: Bell,
      color: "text-text-secondary bg-surface-tertiary",
    }
  );
}

// ---- Component -------------------------------------------------------------

export function NotificationCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Unread count (always active)
  const { data: unreadData } = useQuery(notificationUnreadCountOptions());
  const unreadCount = unreadData?.count ?? 0;

  // Notification list (only when panel is open)
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api.get<NotificationsResponse>("/api/notifications?limit=20"),
    enabled: open,
  });

  const notifications = notificationsData?.data ?? [];

  // Mutations
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

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) {
        markRead.mutate(notification.id);
      }
      // Navigate to resource if available
      if (notification.resourceType === "conversation" && notification.resourceId) {
        navigate({ to: "/conversations/$id", params: { id: notification.resourceId } });
        setOpen(false);
      }
    },
    [markRead, navigate],
  );

  return (
    <div ref={panelRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          "relative p-2 rounded-lg transition-colors",
          "text-text-secondary hover:text-text hover:bg-surface-secondary",
          open && "bg-surface-secondary text-text",
        )}
        aria-label={t("notifications.title", { defaultValue: "Notifications" })}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1 pointer-events-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={clsx(
            "absolute right-0 top-full mt-2 z-50",
            "w-96 rounded-xl border border-border bg-surface shadow-xl",
            "animate-in fade-in zoom-in-95 duration-150 origin-top-right",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text">
              {t("notifications.title", { defaultValue: "Notifications" })}
            </span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  {t("notifications.markAllRead", { defaultValue: "Mark all read" })}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-0.5 text-text-tertiary hover:text-text rounded transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0">
                    <div className="h-8 w-8 rounded-lg bg-surface-tertiary animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 bg-surface-tertiary rounded animate-pulse" />
                      <div className="h-2.5 w-1/2 bg-surface-tertiary rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <Bell className="h-8 w-8 text-text-tertiary mb-2.5" />
                <p className="text-sm font-medium text-text-secondary">
                  {t("notifications.empty", { defaultValue: "All caught up!" })}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {t("notifications.emptyDesc", { defaultValue: "No new notifications" })}
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = getTypeConfig(notification.type);
                const Icon = config.icon;
                const [iconColor, iconBg] = config.color.split(" ");

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={clsx(
                      "w-full flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0",
                      "text-left transition-colors hover:bg-surface-secondary",
                      !notification.isRead && "bg-primary/[0.03]",
                    )}
                  >
                    {/* Type icon */}
                    <div
                      className={clsx(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        iconBg,
                      )}
                    >
                      <Icon className={clsx("h-4 w-4", iconColor)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={clsx(
                            "text-sm leading-snug",
                            notification.isRead ? "text-text-secondary" : "text-text font-medium",
                          )}
                        >
                          {notification.title}
                        </p>
                        {/* Unread dot */}
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      {notification.body && (
                        <p className="text-xs text-text-tertiary mt-0.5 truncate">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-[10px] text-text-tertiary mt-1">
                        {notification.createdAt && formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <button
              onClick={() => {
                navigate({ to: "/settings/notifications" });
                setOpen(false);
              }}
              className="text-xs text-primary hover:text-primary-dark transition-colors font-medium w-full text-center"
            >
              {t("notifications.viewAll", { defaultValue: "View all notifications" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
