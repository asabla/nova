import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Shield, Clock, Globe, AlertTriangle, Lock, Key, Users, CheckCircle, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

interface SecurityPolicies {
  mfaRequired: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  passwordExpiryDays: number | null;
  sessionMaxAge: number;
}

interface MfaStatus {
  totalMembers: number;
  mfaEnrolled: number;
  mfaNotEnrolled: number;
  enrollmentPct: number;
}

export const Route = createFileRoute("/_auth/admin/security")({
  component: SecurityPage,
});

function ToggleSwitch({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className="text-sm font-medium text-text">{label}</span>
        {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-primary" : "bg-surface-tertiary"
        }`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`} />
      </button>
    </div>
  );
}

function SecurityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.get<any>("/api/org/audit-logs?limit=50"),
    staleTime: 30_000,
  });

  const { data: policies, isLoading: policiesLoading } = useQuery<SecurityPolicies>({
    queryKey: ["security-policies"],
    queryFn: () => api.get<SecurityPolicies>("/api/org/security-policies"),
    staleTime: 60_000,
  });

  const { data: mfaStatus, isLoading: mfaLoading } = useQuery<MfaStatus>({
    queryKey: ["mfa-status"],
    queryFn: () => api.get<MfaStatus>("/api/org/mfa-status"),
    staleTime: 60_000,
  });

  const updatePolicies = useMutation({
    mutationFn: (data: Partial<SecurityPolicies>) =>
      api.patch<SecurityPolicies>("/api/org/security-policies", data),
    onSuccess: (data) => {
      queryClient.setQueryData(["security-policies"], data);
      toast(t("admin.securityPoliciesUpdated", { defaultValue: "Security policies updated" }), "success");
    },
    onError: () => {
      toast(t("admin.securityPoliciesUpdateFailed", { defaultValue: "Failed to update security policies" }), "error");
    },
  });

  const logs = (auditData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text">{t("admin.securityTitle", { defaultValue: "Security" })}</h2>
        <p className="text-sm text-text-secondary mt-1">{t("admin.securityDescription", { defaultValue: "Manage authentication, password policies, and security settings." })}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm font-medium text-text">{t("admin.tls", { defaultValue: "TLS" })}</span>
          </div>
          <p className="text-xs text-text-secondary">{t("admin.tlsDescription", { defaultValue: "All data in transit encrypted with TLS 1.3+" })}</p>
        </div>
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-text">{t("admin.ssrfProtection", { defaultValue: "SSRF Protection" })}</span>
          </div>
          <p className="text-xs text-text-secondary">{t("admin.ssrfDescription", { defaultValue: "Private IP ranges blocked on all URL operations" })}</p>
        </div>
        <div className="bg-surface-secondary border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
            <span className="text-sm font-medium text-text">{t("admin.rateLimiting", { defaultValue: "Rate Limiting" })}</span>
          </div>
          <p className="text-xs text-text-secondary">{t("admin.rateLimitingDescription", { defaultValue: "Per-user, per-IP, and per-org rate limits active" })}</p>
        </div>
      </div>

      {/* MFA Enrollment Status */}
      {mfaLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : mfaStatus ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-medium text-text">{t("admin.mfaEnrollmentStatus", { defaultValue: "MFA Enrollment Status" })}</h3>
          </div>
          <div className="bg-surface-secondary border border-border rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-text-tertiary">{t("admin.totalMembers", { defaultValue: "Total Members" })}</p>
                <p className="text-xl font-semibold text-text">{mfaStatus.totalMembers}</p>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">{t("admin.mfaEnrolled", { defaultValue: "MFA Enrolled" })}</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
                  <p className="text-xl font-semibold text-success">{mfaStatus.mfaEnrolled}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">{t("admin.notEnrolled", { defaultValue: "Not Enrolled" })}</p>
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />
                  <p className="text-xl font-semibold text-danger">{mfaStatus.mfaNotEnrolled}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-text-tertiary">{t("admin.enrollmentRate", { defaultValue: "Enrollment Rate" })}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-text">{mfaStatus.enrollmentPct}%</p>
                  <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        mfaStatus.enrollmentPct === 100 ? "bg-success" : mfaStatus.enrollmentPct >= 50 ? "bg-warning" : "bg-danger"
                      }`}
                      style={{ width: `${mfaStatus.enrollmentPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Security Policies */}
      <SecurityPoliciesForm
        policies={policies}
        isLoading={policiesLoading}
        onSave={(data) => updatePolicies.mutate(data)}
        isSaving={updatePolicies.isPending}
        onSaveSuccess={updatePolicies.isSuccess}
      />

      {/* Audit Log */}
      <div>
        <h3 className="text-sm font-medium text-text mb-3">{t("admin.auditLog", { defaultValue: "Audit Log" })}</h3>
        {auditLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="bg-surface-secondary border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">{t("admin.action", { defaultValue: "Action" })}</th>
                  <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">{t("admin.user", { defaultValue: "User" })}</th>
                  <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">{t("admin.resource", { defaultValue: "Resource" })}</th>
                  <th className="text-left px-4 py-2 text-xs text-text-tertiary font-medium">{t("admin.time", { defaultValue: "Time" })}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-surface-tertiary/50">
                    <td className="px-4 py-2 text-text">{log.action}</td>
                    <td className="px-4 py-2 text-text-secondary">{log.userId?.slice(0, 8)}...</td>
                    <td className="px-4 py-2 text-text-secondary">{log.resourceType}</td>
                    <td className="px-4 py-2 text-text-tertiary text-xs">
                      {log.createdAt && formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-text-tertiary">{t("admin.noAuditLogs", { defaultValue: "No audit logs yet" })}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SecurityPoliciesForm({ policies, isLoading, onSave, isSaving, onSaveSuccess }: {
  policies?: SecurityPolicies; isLoading: boolean; onSave: (data: Partial<SecurityPolicies>) => void; isSaving: boolean; onSaveSuccess: boolean;
}) {
  const { t } = useTranslation();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [passwordMinLength, setPasswordMinLength] = useState(8);
  const [passwordRequireUppercase, setPasswordRequireUppercase] = useState(false);
  const [passwordRequireNumbers, setPasswordRequireNumbers] = useState(false);
  const [passwordRequireSymbols, setPasswordRequireSymbols] = useState(false);
  const [passwordExpiryEnabled, setPasswordExpiryEnabled] = useState(false);
  const [passwordExpiryDays, setPasswordExpiryDays] = useState(90);
  const [sessionMaxAge, setSessionMaxAge] = useState(24);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (policies) {
      setMfaRequired(policies.mfaRequired);
      setPasswordMinLength(policies.passwordMinLength);
      setPasswordRequireUppercase(policies.passwordRequireUppercase);
      setPasswordRequireNumbers(policies.passwordRequireNumbers);
      setPasswordRequireSymbols(policies.passwordRequireSymbols);
      setPasswordExpiryEnabled(policies.passwordExpiryDays !== null);
      setPasswordExpiryDays(policies.passwordExpiryDays ?? 90);
      setSessionMaxAge(policies.sessionMaxAge);
      setDirty(false);
    }
  }, [policies]);

  // Clear dirty state on successful save (fixes race condition)
  useEffect(() => {
    if (onSaveSuccess) {
      setDirty(false);
    }
  }, [onSaveSuccess]);

  const markDirty = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const handleSave = () => {
    onSave({
      mfaRequired,
      passwordMinLength,
      passwordRequireUppercase,
      passwordRequireNumbers,
      passwordRequireSymbols,
      passwordExpiryDays: passwordExpiryEnabled ? passwordExpiryDays : null,
      sessionMaxAge,
    });
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-medium text-text">{t("admin.securityPolicies", { defaultValue: "Security Policies" })}</h3>
        </div>
        {dirty && (
          <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving}>
            {t("admin.saveChanges", { defaultValue: "Save Changes" })}
          </Button>
        )}
      </div>

      <div className="bg-surface-secondary border border-border rounded-xl p-5 space-y-1">
        {/* MFA Section */}
        <div className="pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{t("admin.mfa", { defaultValue: "Multi-Factor Authentication" })}</span>
          </div>
          <ToggleSwitch
            checked={mfaRequired}
            onChange={markDirty(setMfaRequired)}
            label={t("admin.requireMfa", { defaultValue: "Require MFA for all users" })}
            description={t("admin.requireMfaDescription", { defaultValue: "When enabled, all organization members must set up MFA to access the platform" })}
          />
        </div>

        {/* Password Policy Section */}
        <div className="py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{t("admin.passwordPolicy", { defaultValue: "Password Policy" })}</span>
          </div>

          <div className="py-3">
            <label className="block text-sm font-medium text-text mb-1.5">{t("admin.minPasswordLength", { defaultValue: "Minimum password length" })}</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={6}
                max={32}
                value={passwordMinLength}
                onChange={(e) => { setPasswordMinLength(Number(e.target.value)); setDirty(true); }}
                className="flex-1 h-1.5 bg-surface-tertiary rounded-full appearance-none cursor-pointer accent-primary"
              />
              <span className="text-sm font-mono text-text w-8 text-right">{passwordMinLength}</span>
            </div>
            <p className="text-xs text-text-tertiary mt-1">{t("admin.passwordLengthHint", { defaultValue: "Characters required (6-32)" })}</p>
          </div>

          <ToggleSwitch
            checked={passwordRequireUppercase}
            onChange={markDirty(setPasswordRequireUppercase)}
            label={t("admin.requireUppercase", { defaultValue: "Require uppercase letter" })}
            description={t("admin.requireUppercaseDescription", { defaultValue: "At least one uppercase letter (A-Z)" })}
          />
          <ToggleSwitch
            checked={passwordRequireNumbers}
            onChange={markDirty(setPasswordRequireNumbers)}
            label={t("admin.requireNumber", { defaultValue: "Require number" })}
            description={t("admin.requireNumberDescription", { defaultValue: "At least one numeric digit (0-9)" })}
          />
          <ToggleSwitch
            checked={passwordRequireSymbols}
            onChange={markDirty(setPasswordRequireSymbols)}
            label={t("admin.requireSymbol", { defaultValue: "Require special character" })}
            description={t("admin.requireSymbolDescription", { defaultValue: "At least one symbol (!@#$%^&*...)" })}
          />

          <div className="py-3">
            <ToggleSwitch
              checked={passwordExpiryEnabled}
              onChange={(v) => { setPasswordExpiryEnabled(v); setDirty(true); }}
              label={t("admin.passwordExpiration", { defaultValue: "Password expiration" })}
              description={t("admin.passwordExpirationDescription", { defaultValue: "Force users to change passwords periodically" })}
            />
            {passwordExpiryEnabled && (
              <div className="ml-0 mt-2">
                <label className="block text-xs text-text-secondary mb-1">{t("admin.expireAfterDays", { defaultValue: "Expire after (days)" })}</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={passwordExpiryDays}
                  onChange={(e) => { setPasswordExpiryDays(Number(e.target.value)); setDirty(true); }}
                  className="w-24 h-8 px-2 text-sm bg-surface border border-border rounded-lg text-text"
                />
              </div>
            )}
          </div>
        </div>

        {/* Session Section */}
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{t("admin.sessionManagement", { defaultValue: "Session Management" })}</span>
          </div>
          <div className="py-3">
            <label className="block text-sm font-medium text-text mb-1.5">{t("admin.maxSessionDuration", { defaultValue: "Maximum session duration" })}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={720}
                value={sessionMaxAge}
                onChange={(e) => { setSessionMaxAge(Number(e.target.value)); setDirty(true); }}
                className="w-24 h-8 px-2 text-sm bg-surface border border-border rounded-lg text-text"
              />
              <span className="text-sm text-text-secondary">{t("admin.hours", { defaultValue: "hours" })}</span>
            </div>
            <p className="text-xs text-text-tertiary mt-1">{t("admin.sessionDurationHint", { defaultValue: "Sessions will expire after this duration (1-720 hours)" })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
