import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface NotificationPrefs {
  emailOnShare: boolean;
  emailOnMention: boolean;
  emailOnAgentComplete: boolean;
  inAppEnabled: boolean;
}

export const Route = createFileRoute("/_auth/settings/notifications")({
  component: NotificationSettings,
});

function NotificationSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: prefsResponse } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<{ data: NotificationPrefs }>("/api/notifications/preferences"),
  });

  const prefs = prefsResponse?.data;

  const updatePrefs = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) =>
      api.patch("/api/notifications/preferences", patch),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });

  const togglePref = (key: keyof NotificationPrefs, value: boolean) => {
    updatePrefs.mutate({ [key]: value });
  };

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-sm font-semibold text-text mb-1">
          {t("settings.notificationPreferences", "Notification Preferences")}
        </h3>
        <p className="text-xs text-text-tertiary mb-4">
          {t("settings.notificationPreferencesDescription", "Choose how and when you want to be notified.")}
        </p>
      </div>

      <div className="space-y-3">
        <Toggle
          label={t("settings.inAppNotifications", "In-app notifications")}
          description="Show real-time notifications inside the app"
          checked={prefs?.inAppEnabled ?? true}
          onChange={(v) => togglePref("inAppEnabled", v)}
        />
        <Toggle
          label={t("settings.emailOnShare", "Email on conversation share")}
          description="Receive an email when someone shares a conversation with you"
          checked={prefs?.emailOnShare ?? true}
          onChange={(v) => togglePref("emailOnShare", v)}
        />
        <Toggle
          label={t("settings.emailOnMention", "Email on @mention")}
          description="Receive an email when someone mentions you in a message"
          checked={prefs?.emailOnMention ?? true}
          onChange={(v) => togglePref("emailOnMention", v)}
        />
        <Toggle
          label={t("settings.emailOnAgentComplete", "Email on agent completion")}
          description="Receive an email when an agent run finishes"
          checked={prefs?.emailOnAgentComplete ?? false}
          onChange={(v) => togglePref("emailOnAgentComplete", v)}
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
