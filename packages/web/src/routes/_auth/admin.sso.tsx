import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Shield, Plus, Trash2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/sso")({
  component: AdminSsoPage,
});

const SSO_TYPES = [
  { value: "azure-ad", label: "Azure AD / Entra ID" },
  { value: "google", label: "Google Workspace" },
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "oidc", label: "Generic OIDC" },
  { value: "saml", label: "SAML" },
];

function AdminSsoPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [form, setForm] = useState({
    type: "oidc",
    providerName: "",
    clientId: "",
    clientSecret: "",
    issuerUrl: "",
    autoProvisionUsers: false,
    defaultRole: "member",
  });

  const { data: providersData, isLoading } = useQuery({
    queryKey: ["sso-providers"],
    queryFn: () => api.get<any>("/api/sso"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/api/sso", data),
    onSuccess: () => {
      toast(t("admin.ssoProviderAdded", { defaultValue: "SSO provider added" }), "success");
      queryClient.invalidateQueries({ queryKey: ["sso-providers"] });
      setShowCreate(false);
    },
    onError: (err: any) => toast(err.message ?? t("admin.ssoProviderAddFailed", { defaultValue: "Failed to add SSO provider" }), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/sso/${id}`),
    onSuccess: () => {
      toast(t("admin.ssoProviderRemoved", { defaultValue: "SSO provider removed" }), "success");
      queryClient.invalidateQueries({ queryKey: ["sso-providers"] });
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast(err.message ?? t("admin.ssoProviderRemoveFailed", { defaultValue: "Failed to remove SSO provider" }), "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/sso/${id}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sso-providers"] }),
    onError: (err: any) => toast(err.message ?? t("admin.ssoToggleFailed", { defaultValue: "Failed to update provider" }), "error"),
  });

  const handleTest = async (id: string) => {
    try {
      const result = await api.post<any>(`/api/sso/${id}/test`, {});
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, error: err.message } }));
    }
  };

  const providers = (providersData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("admin.ssoTitle", { defaultValue: "Single Sign-On" })}</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.ssoDescription", { defaultValue: "Configure SSO providers for your organization." })}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.addProvider", { defaultValue: "Add Provider" })}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider: any) => (
            <div key={provider.id} className="p-4 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-text">{provider.providerName}</p>
                    <p className="text-xs text-text-tertiary">
                      {SSO_TYPES.find((ssoType) => ssoType.value === provider.type)?.label ?? provider.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={provider.isEnabled ? "success" : "default"}>
                    {provider.isEnabled ? t("admin.active", { defaultValue: "Active" }) : t("admin.disabled", { defaultValue: "Disabled" })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: provider.id, isEnabled: !provider.isEnabled })}
                  >
                    {provider.isEnabled ? t("admin.disable", { defaultValue: "Disable" }) : t("admin.enable", { defaultValue: "Enable" })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(provider.id)}
                    aria-label={t("admin.testProvider", { defaultValue: "Test provider" })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.test", { defaultValue: "Test" })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => setDeleteConfirmId(provider.id)}
                    aria-label={t("admin.removeProvider", { defaultValue: "Remove provider" })}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="text-xs text-text-tertiary space-y-1">
                <p>{t("admin.clientId", { defaultValue: "Client ID" })}: <span className="font-mono">{provider.clientId}</span></p>
                {provider.issuerUrl && <p>{t("admin.issuer", { defaultValue: "Issuer" })}: <span className="font-mono">{provider.issuerUrl}</span></p>}
                <p>{t("admin.autoProvision", { defaultValue: "Auto-provision" })}: {provider.autoProvisionUsers ? t("admin.yes", { defaultValue: "Yes" }) : t("admin.no", { defaultValue: "No" })} | {t("admin.defaultRole", { defaultValue: "Default role" })}: {provider.defaultRole}</p>
              </div>

              {testResults[provider.id] && (
                <div className={`mt-3 p-2 rounded-lg text-xs ${
                  testResults[provider.id].success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}>
                  {testResults[provider.id].success ? (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                      {t("admin.connectionSuccessful", { defaultValue: "Connection successful." })} {t("admin.issuer", { defaultValue: "Issuer" })}: {testResults[provider.id].issuer}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                      {t("admin.failed", { defaultValue: "Failed" })}: {testResults[provider.id].error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {providers.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-text mb-1">{t("admin.noSsoProviders", { defaultValue: "No SSO Providers" })}</h3>
              <p className="text-sm text-text-secondary mb-4">{t("admin.noSsoProvidersDescription", { defaultValue: "Add a provider to enable single sign-on for your organization." })}</p>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title={t("admin.addSsoProvider", { defaultValue: "Add SSO Provider" })}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("admin.providerType", { defaultValue: "Provider Type" })}</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            >
              {SSO_TYPES.map((ssoType) => (
                <option key={ssoType.value} value={ssoType.value}>{ssoType.label}</option>
              ))}
            </select>
          </div>
          <Input
            label={t("admin.providerName", { defaultValue: "Provider Name" })}
            value={form.providerName}
            onChange={(e) => setForm({ ...form, providerName: e.target.value })}
            placeholder={t("admin.providerNamePlaceholder", { defaultValue: "e.g., Corporate Azure AD" })}
            required
          />
          <Input
            label={t("admin.clientId", { defaultValue: "Client ID" })}
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            required
          />
          <Input
            label={t("admin.clientSecret", { defaultValue: "Client Secret" })}
            type="password"
            value={form.clientSecret}
            onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
            required
          />
          <Input
            label={t("admin.issuerUrl", { defaultValue: "Issuer URL" })}
            value={form.issuerUrl}
            onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })}
            placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoProvision"
              checked={form.autoProvisionUsers}
              onChange={(e) => setForm({ ...form, autoProvisionUsers: e.target.checked })}
              className="rounded border-border"
            />
            <label htmlFor="autoProvision" className="text-sm text-text">{t("admin.autoProvisionLabel", { defaultValue: "Auto-provision users on first login" })}</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
            <Button type="submit" variant="primary" loading={createMutation.isPending}>{t("admin.addProvider", { defaultValue: "Add Provider" })}</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title={t("admin.confirmDelete", { defaultValue: "Confirm Delete" })}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t("admin.confirmDeleteSsoProvider", { defaultValue: "Are you sure you want to remove this SSO provider? Users who sign in via this provider will no longer be able to authenticate." })}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              {t("admin.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-danger hover:bg-danger/90"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              loading={deleteMutation.isPending}
            >
              {t("admin.remove", { defaultValue: "Remove" })}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
