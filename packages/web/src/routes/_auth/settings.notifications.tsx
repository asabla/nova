import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { toast } from "../../components/ui/Toast";
import { Switch } from "../../components/ui/Switch";

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
    onMutate: async (patch) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notification-preferences"] });
      // Snapshot previous value
      const previous = queryClient.getQueryData<{ data: NotificationPrefs }>(["notification-preferences"]);
      // Optimistically update
      queryClient.setQueryData<{ data: NotificationPrefs }>(["notification-preferences"], (old) => {
        if (!old) return old;
        return { ...old, data: { ...old.data, ...patch } };
      });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["notification-preferences"], context.previous);
      }
      toast(t("settings.notificationUpdateFailed", "Failed to update notification preferences."), "error");
    },
    onSettled: () =>
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
        <Switch
          label={t("settings.inAppNotifications", "In-app notifications")}
          description={t("settings.inAppNotificationsDescription", "Show real-time notifications inside the app")}
          checked={prefs?.inAppEnabled ?? true}
          onChange={(v) => togglePref("inAppEnabled", v)}
        />
        <Switch
          label={t("settings.emailOnShare", "Email on conversation share")}
          description={t("settings.emailOnShareDescription", "Receive an email when someone shares a conversation with you")}
          checked={prefs?.emailOnShare ?? true}
          onChange={(v) => togglePref("emailOnShare", v)}
        />
        <Switch
          label={t("settings.emailOnMention", "Email on @mention")}
          description={t("settings.emailOnMentionDescription", "Receive an email when someone mentions you in a message")}
          checked={prefs?.emailOnMention ?? true}
          onChange={(v) => togglePref("emailOnMention", v)}
        />
        <Switch
          label={t("settings.emailOnAgentComplete", "Email on agent completion")}
          description={t("settings.emailOnAgentCompleteDescription", "Receive an email when an agent run finishes")}
          checked={prefs?.emailOnAgentComplete ?? false}
          onChange={(v) => togglePref("emailOnAgentComplete", v)}
        />
      </div>
    </div>
  );
}

