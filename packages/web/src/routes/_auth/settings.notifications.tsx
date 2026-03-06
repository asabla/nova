import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";

export const Route = createFileRoute("/_auth/settings/notifications")({
  component: NotificationSettings,
});

function NotificationSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<any>("/api/notifications/preferences"),
  });

  const updatePrefs = useMutation({
    mutationFn: (data: any) => api.put("/api/notifications/preferences", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });

  const togglePref = (key: string, value: boolean) => {
    updatePrefs.mutate({ ...prefs, [key]: value });
  };

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-3">
        <Toggle
          label={t("settings.emailNotifications")}
          description="Receive email notifications for important updates"
          checked={prefs?.emailEnabled ?? true}
          onChange={(v) => togglePref("emailEnabled", v)}
        />
        <Toggle
          label={t("settings.mentionNotifications")}
          description="Get notified when someone mentions you"
          checked={prefs?.mentionsEnabled ?? true}
          onChange={(v) => togglePref("mentionsEnabled", v)}
        />
        <Toggle
          label={t("settings.conversationUpdates")}
          description="Notifications for conversations you participate in"
          checked={prefs?.conversationUpdatesEnabled ?? true}
          onChange={(v) => togglePref("conversationUpdatesEnabled", v)}
        />
      </div>
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-surface-secondary border border-border">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-primary" : "bg-border-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
