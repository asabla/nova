import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/settings/security")({
  component: SecuritySettings,
});

function SecuritySettings() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: sessions } = useQuery({
    queryKey: queryKeys.user.sessions(),
    queryFn: () => api.get<any>("/api/users/me/sessions"),
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => api.post(`/api/users/me/sessions/${sessionId}/revoke`),
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(t("settings.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("settings.passwordTooShort"));
      return;
    }

    try {
      await api.post("/api/users/me/change-password", {
        currentPassword,
        newPassword,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError(t("settings.passwordChangeFailed"));
    }
  };

  return (
    <div className="space-y-8 max-w-md">
      <div>
        <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t("settings.changePassword")}
        </h3>

        <form onSubmit={handlePasswordChange} className="space-y-3">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-success/10 border border-success/20 text-success text-sm rounded-lg px-3 py-2">
              {t("settings.passwordChanged")}
            </div>
          )}

          <Input
            label={t("settings.currentPassword")}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label={t("settings.newPassword")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            label={t("settings.confirmPassword")}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary">{t("settings.updatePassword")}</Button>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text mb-4">{t("settings.activeSessions")}</h3>
        <div className="space-y-2">
          {(sessions as any)?.data?.map((session: any) => (
            <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
              <div>
                <p className="text-sm text-text">{session.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-text-tertiary">
                  {session.ipAddress} - {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                </p>
              </div>
              <button
                onClick={() => revokeSession.mutate(session.id)}
                className="text-text-tertiary hover:text-danger p-1 rounded transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
