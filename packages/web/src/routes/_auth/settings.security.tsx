import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, Smartphone, CheckCircle, XCircle, Key } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { QRCode } from "../../components/ui/QRCode";
import { formatRelativeTime } from "../../lib/format";

export const Route = createFileRoute("/_auth/settings/security")({
  component: SecuritySettings,
});

function SecuritySkeleton() {
  return (
    <div className="space-y-8 max-w-md animate-pulse">
      <div className="space-y-3">
        <div className="h-4 w-40 bg-surface-secondary rounded" />
        <div className="space-y-3">
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
        </div>
        <div className="h-9 w-36 bg-surface-secondary rounded-lg" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-56 bg-surface-secondary rounded" />
        <div className="h-24 w-full bg-surface-secondary rounded-xl" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-32 bg-surface-secondary rounded" />
        <div className="h-16 w-full bg-surface-secondary rounded-xl" />
        <div className="h-16 w-full bg-surface-secondary rounded-xl" />
      </div>
    </div>
  );
}

function SecuritySettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);

  // TOTP state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [showDisable2faDialog, setShowDisable2faDialog] = useState(false);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: queryKeys.user.sessions(),
    queryFn: () => api.get<any>("/api/users/me/sessions"),
  });

  const { data: totpStatus, isLoading: totpLoading } = useQuery({
    queryKey: ["totp-status"],
    queryFn: () => api.get<any>("/api/auth/totp/status"),
    staleTime: 60_000,
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/api/users/me/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.sessions() });
      toast(t("settings.sessionRevoked", "Session revoked"), "success");
    },
    onError: () => {
      toast(t("settings.sessionRevokeFailed", "Failed to revoke session"), "error");
    },
  });

  const setupTotp = useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUri: string }>("/api/auth/totp/setup"),
    onSuccess: (data) => {
      setTotpSetup(data);
    },
    onError: () => {
      toast(t("settings.totpSetupFailed", "Failed to set up two-factor authentication"), "error");
    },
  });

  const verifyTotp = useMutation({
    mutationFn: (code: string) => api.post("/api/auth/totp/verify", { code }),
    onSuccess: () => {
      setTotpSetup(null);
      setTotpCode("");
      queryClient.invalidateQueries({ queryKey: ["totp-status"] });
      toast(t("settings.totpEnabled", "Two-factor authentication enabled"), "success");
    },
    onError: () => {
      setTotpError(t("settings.totpInvalidCode", "Invalid code. Please try again."));
    },
  });

  const disableTotp = useMutation({
    mutationFn: () => api.post("/api/auth/totp/disable"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["totp-status"] });
      setShowDisable2faDialog(false);
      toast(t("settings.totpDisabled", "Two-factor authentication disabled"), "success");
    },
    onError: () => {
      toast(t("settings.totpDisableFailed", "Failed to disable two-factor authentication"), "error");
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

    setPasswordChanging(true);
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
    } finally {
      setPasswordChanging(false);
    }
  };

  const totpEnabled = (totpStatus as any)?.enabled ?? false;

  if (sessionsLoading && totpLoading) {
    return <SecuritySkeleton />;
  }

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
            <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div role="alert" className="bg-success/10 border border-success/20 text-success text-sm rounded-lg px-3 py-2">
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

          <Button type="submit" variant="primary" loading={passwordChanging}>
            {t("settings.updatePassword")}
          </Button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div>
        <h3 className="text-sm font-medium text-text mb-4 flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          {t("settings.twoFactorAuth", "Two-Factor Authentication (TOTP)")}
        </h3>

        {totpLoading ? (
          <div className="h-24 w-full bg-surface-secondary rounded-xl animate-pulse" />
        ) : (
          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {totpEnabled ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-text-tertiary" />
                )}
                <span className="text-sm text-text font-medium">
                  {totpEnabled
                    ? t("settings.totpStatusEnabled", "Enabled")
                    : t("settings.totpStatusDisabled", "Not enabled")}
                </span>
              </div>
              {totpEnabled ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDisable2faDialog(true)}
                  loading={disableTotp.isPending}
                >
                  {t("settings.disable2fa", "Disable 2FA")}
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setupTotp.mutate()} loading={setupTotp.isPending}>
                  {t("settings.enable2fa", "Enable 2FA")}
                </Button>
              )}
            </div>

            <p className="text-xs text-text-tertiary">
              {totpEnabled
                ? t("settings.totpEnabledDescription", "Your account is protected with two-factor authentication.")
                : t("settings.totpDisabledDescription", "Add an extra layer of security by enabling TOTP-based two-factor authentication.")}
            </p>
          </div>
        )}

        {/* Disable 2FA Confirmation Dialog */}
        <Dialog
          open={showDisable2faDialog}
          onClose={() => setShowDisable2faDialog(false)}
          title={t("settings.disable2faTitle", "Disable Two-Factor Authentication")}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {t("settings.disable2faConfirmation", "Are you sure you want to disable two-factor authentication? This will make your account less secure.")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowDisable2faDialog(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={() => disableTotp.mutate()}
                loading={disableTotp.isPending}
              >
                {t("settings.disable2faConfirm", "Disable 2FA")}
              </Button>
            </div>
          </div>
        </Dialog>

        {/* TOTP Setup Flow */}
        {totpSetup && (
          <div className="mt-4 p-4 rounded-xl bg-surface border border-primary/20 space-y-4">
            <div>
              <p className="text-sm font-medium text-text mb-2">
                {t("settings.totpStep1", "1. Scan this QR code with your authenticator app")}
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCode data={totpSetup.otpauthUri} />
              </div>
              <p className="text-xs text-text-tertiary text-center mt-2">
                {t("settings.totpManualEntry", "Or enter this secret manually:")}{" "}
                <code className="bg-surface-secondary px-1 py-0.5 rounded text-text">{totpSetup.secret}</code>
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-text mb-2">
                {t("settings.totpStep2", "2. Enter the 6-digit code from your app")}
              </p>
              {totpError && (
                <div role="alert" className="bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg px-3 py-2 mb-2">
                  {totpError}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={totpCode}
                  onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTotpError(""); }}
                  placeholder="000000"
                  maxLength={6}
                  aria-label={t("settings.totpCodeLabel", "TOTP verification code")}
                  className="w-32 text-center text-lg font-mono tracking-widest bg-surface-secondary"
                />
                <Button
                  variant="primary"
                  onClick={() => verifyTotp.mutate(totpCode)}
                  disabled={totpCode.length !== 6}
                  loading={verifyTotp.isPending}
                >
                  {t("settings.totpVerify", "Verify")}
                </Button>
                <Button variant="ghost" onClick={() => setTotpSetup(null)}>
                  {t("common.cancel", "Cancel")}
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
          {sessionsLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-16 w-full bg-surface-secondary rounded-xl" />
              <div className="h-16 w-full bg-surface-secondary rounded-xl" />
            </div>
          ) : (
            <>
              {(sessions as any)?.data?.length === 0 && (
                <p className="text-sm text-text-tertiary">
                  {t("settings.noActiveSessions", "No active sessions found.")}
                </p>
              )}
              {(sessions as any)?.data?.map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
                  <div>
                    <p className="text-sm text-text">
                      {session.userAgent ?? t("settings.unknownDevice", "Unknown device")}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {session.ipAddress} - {formatRelativeTime(session.createdAt)}
                      {session.isCurrent && (
                        <span className="text-primary ml-1">
                          ({t("settings.currentSession", "current")})
                        </span>
                      )}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => revokeSession.mutate(session.id)}
                      aria-label={t("settings.revokeSession", "Revoke session")}
                      className="text-text-tertiary hover:text-danger p-1 rounded transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
