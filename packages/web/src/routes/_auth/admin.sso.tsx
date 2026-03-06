import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Trash2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
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
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
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

  const { data: providersData } = useQuery({
    queryKey: ["sso-providers"],
    queryFn: () => api.get<any>("/api/sso"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/api/sso", data),
    onSuccess: () => {
      toast.success("SSO provider added");
      queryClient.invalidateQueries({ queryKey: ["sso-providers"] });
      setShowCreate(false);
    },
    onError: (err: any) => toast.error(err.message ?? "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/sso/${id}`),
    onSuccess: () => {
      toast.success("SSO provider removed");
      queryClient.invalidateQueries({ queryKey: ["sso-providers"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/sso/${id}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sso-providers"] }),
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
          <h2 className="text-sm font-medium text-text">Single Sign-On</h2>
          <p className="text-xs text-text-tertiary mt-1">Configure SSO providers for your organization.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Provider
        </Button>
      </div>

      <div className="space-y-3">
        {providers.map((provider: any) => (
          <div key={provider.id} className="p-4 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-text">{provider.providerName}</p>
                  <p className="text-xs text-text-tertiary">
                    {SSO_TYPES.find((t) => t.value === provider.type)?.label ?? provider.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={provider.isEnabled ? "success" : "default"}>
                  {provider.isEnabled ? "Active" : "Disabled"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleMutation.mutate({ id: provider.id, isEnabled: !provider.isEnabled })}
                >
                  {provider.isEnabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleTest(provider.id)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Test
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => {
                    if (confirm("Remove this SSO provider?")) deleteMutation.mutate(provider.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="text-xs text-text-tertiary space-y-1">
              <p>Client ID: <span className="font-mono">{provider.clientId}</span></p>
              {provider.issuerUrl && <p>Issuer: <span className="font-mono">{provider.issuerUrl}</span></p>}
              <p>Auto-provision: {provider.autoProvisionUsers ? "Yes" : "No"} | Default role: {provider.defaultRole}</p>
            </div>

            {testResults[provider.id] && (
              <div className={`mt-3 p-2 rounded-lg text-xs ${
                testResults[provider.id].success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              }`}>
                {testResults[provider.id].success ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Connection successful. Issuer: {testResults[provider.id].issuer}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Failed: {testResults[provider.id].error}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {providers.length === 0 && (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
            <h3 className="text-lg font-medium text-text mb-1">No SSO Providers</h3>
            <p className="text-sm text-text-secondary mb-4">Add a provider to enable single sign-on for your organization.</p>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Add SSO Provider">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-text mb-1">Provider Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            >
              {SSO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Provider Name"
            value={form.providerName}
            onChange={(e) => setForm({ ...form, providerName: e.target.value })}
            placeholder="e.g., Corporate Azure AD"
            required
          />
          <Input
            label="Client ID"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            required
          />
          <Input
            label="Client Secret"
            type="password"
            value={form.clientSecret}
            onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
            required
          />
          <Input
            label="Issuer URL"
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
            <label htmlFor="autoProvision" className="text-sm text-text">Auto-provision users on first login</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createMutation.isPending}>Add Provider</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
