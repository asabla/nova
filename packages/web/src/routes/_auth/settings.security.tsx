import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, Smartphone, CheckCircle, XCircle, Key } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/settings/security")({
  component: SecuritySettings,
});

function SecuritySettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // TOTP state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");

  const { data: sessions } = useQuery({
    queryKey: queryKeys.user.sessions(),
    queryFn: () => api.get<any>("/api/users/me/sessions"),
  });

  const { data: totpStatus } = useQuery({
    queryKey: ["totp-status"],
    queryFn: () => api.get<any>("/api/auth/totp/status"),
    staleTime: 60_000,
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/api/users/me/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.sessions() });
      toast("Session revoked", "success");
    },
  });

  const setupTotp = useMutation({
    mutationFn: () => api.post<{ secret: string; qrUri: string }>("/api/auth/totp/setup"),
    onSuccess: (data) => {
      setTotpSetup(data);
    },
  });

  const verifyTotp = useMutation({
    mutationFn: (code: string) => api.post("/api/auth/totp/verify", { code }),
    onSuccess: () => {
      setTotpSetup(null);
      setTotpCode("");
      queryClient.invalidateQueries({ queryKey: ["totp-status"] });
      toast("Two-factor authentication enabled", "success");
    },
    onError: () => {
      setTotpError("Invalid code. Please try again.");
    },
  });

  const disableTotp = useMutation({
    mutationFn: () => api.post("/api/auth/totp/disable"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["totp-status"] });
      toast("Two-factor authentication disabled", "success");
    },
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

  const totpEnabled = (totpStatus as any)?.enabled ?? false;

  return (
    <div className="space-y-8 max-w-md">
      {/* Password Change */}
      <div>
        <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
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

      {/* Two-Factor Authentication */}
      <div>
        <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Two-Factor Authentication (TOTP)
        </h3>

        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {totpEnabled ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-text-tertiary" />
              )}
              <span className="text-sm text-text font-medium">
                {totpEnabled ? "Enabled" : "Not enabled"}
              </span>
            </div>
            {totpEnabled ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (confirm("Disable two-factor authentication?")) disableTotp.mutate();
                }}
                loading={disableTotp.isPending}
              >
                Disable 2FA
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setupTotp.mutate()} loading={setupTotp.isPending}>
                Enable 2FA
              </Button>
            )}
          </div>

          <p className="text-xs text-text-tertiary">
            {totpEnabled
              ? "Your account is protected with two-factor authentication."
              : "Add an extra layer of security by enabling TOTP-based two-factor authentication."}
          </p>
        </div>

        {/* TOTP Setup Flow */}
        {totpSetup && (
          <div className="mt-4 p-4 rounded-xl bg-surface border border-primary/20 space-y-4">
            <div>
              <p className="text-sm font-medium text-text mb-2">1. Scan this QR code with your authenticator app</p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetup.qrUri)}`}
                  alt="TOTP QR Code"
                  className="h-48 w-48"
                />
              </div>
              <p className="text-xs text-text-tertiary text-center mt-2">
                Or enter this secret manually: <code className="bg-surface-secondary px-1 py-0.5 rounded text-text">{totpSetup.secret}</code>
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-text mb-2">2. Enter the 6-digit code from your app</p>
              {totpError && (
                <div className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg px-3 py-2 mb-2">
                  {totpError}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTotpError(""); }}
                  placeholder="000000"
                  maxLength={6}
                  className="w-32 h-10 px-3 text-center text-lg font-mono tracking-widest bg-surface-secondary border border-border rounded-lg text-text"
                />
                <Button
                  variant="primary"
                  onClick={() => verifyTotp.mutate(totpCode)}
                  disabled={totpCode.length !== 6}
                  loading={verifyTotp.isPending}
                >
                  Verify
                </Button>
                <Button variant="ghost" onClick={() => setTotpSetup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div>
        <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t("settings.activeSessions")}
        </h3>
        <div className="space-y-2">
          {(sessions as any)?.data?.length === 0 && (
            <p className="text-sm text-text-tertiary">No active sessions found.</p>
          )}
          {(sessions as any)?.data?.map((session: any) => (
            <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
              <div>
                <p className="text-sm text-text">{session.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-text-tertiary">
                  {session.ipAddress} - {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  {session.isCurrent && <span className="text-primary ml-1">(current)</span>}
                </p>
              </div>
              {!session.isCurrent && (
                <button
                  onClick={() => revokeSession.mutate(session.id)}
                  className="text-text-tertiary hover:text-danger p-1 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
