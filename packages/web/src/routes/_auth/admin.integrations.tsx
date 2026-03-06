import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Users,
  Mail,
  HardDrive,
  Webhook,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Power,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/integrations")({
  component: AdminIntegrationsPage,
});

type IntegrationType = "slack" | "teams" | "email" | "google-drive" | "webhook";

interface IntegrationConfig {
  type: IntegrationType;
  isEnabled: boolean;
  config: Record<string, unknown>;
  connectedAt?: string;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
}

interface IntegrationMeta {
  type: IntegrationType;
  label: string;
  description: string;
  icon: LucideIcon;
}

const INTEGRATIONS: IntegrationMeta[] = [
  {
    type: "slack",
    label: "Slack",
    description: "Send notifications and conversation summaries to Slack channels.",
    icon: MessageSquare,
  },
  {
    type: "teams",
    label: "Microsoft Teams",
    description: "Forward alerts and updates to Microsoft Teams channels.",
    icon: Users,
  },
  {
    type: "email",
    label: "Email Forwarding",
    description: "Forward conversation transcripts and alerts via SMTP email.",
    icon: Mail,
  },
  {
    type: "google-drive",
    label: "Google Drive",
    description: "Sync knowledge base documents and conversation exports to Google Drive.",
    icon: HardDrive,
  },
  {
    type: "webhook",
    label: "Webhooks",
    description: "Send event payloads to custom HTTP endpoints.",
    icon: Webhook,
  },
];

function AdminIntegrationsPage() {
  const queryClient = useQueryClient();
  const [configuring, setConfiguring] = useState<IntegrationType | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const { data: integrationsData } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.get<{ data: IntegrationConfig[] }>("/api/integrations"),
  });

  const integrations = integrationsData?.data ?? [];

  const getConfig = (type: IntegrationType): IntegrationConfig | undefined =>
    integrations.find((i) => i.type === type);

  const upsertMutation = useMutation({
    mutationFn: ({ type, config, isEnabled }: { type: IntegrationType; config: Record<string, unknown>; isEnabled: boolean }) =>
      api.put(`/api/integrations/${type}`, { config, isEnabled }),
    onSuccess: () => {
      toast.success("Integration saved");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setConfiguring(null);
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (type: IntegrationType) => api.delete(`/api/integrations/${type}`),
    onSuccess: () => {
      toast.success("Integration removed");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ type, config, isEnabled }: { type: IntegrationType; config: Record<string, unknown>; isEnabled: boolean }) =>
      api.put(`/api/integrations/${type}`, { config, isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const handleTest = async (type: IntegrationType) => {
    try {
      const result = await api.post<{ success: boolean; message: string }>(`/api/integrations/${type}/test`, {});
      setTestResults((prev) => ({ ...prev, [type]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [type]: { success: false, message: err.message } }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-text">Integrations</h2>
        <p className="text-xs text-text-tertiary mt-1">
          Connect external services to your NOVA organization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((meta) => {
          const config = getConfig(meta.type);
          const Icon = meta.icon;
          const testResult = testResults[meta.type];

          return (
            <div
              key={meta.type}
              className="p-4 rounded-xl bg-surface-secondary border border-border flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config?.isEnabled ? "bg-primary/10 text-primary" : "bg-surface-tertiary text-text-tertiary"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{meta.label}</p>
                    <Badge variant={config?.isEnabled ? "success" : "default"} className="mt-0.5">
                      {config ? (config.isEnabled ? "Connected" : "Disabled") : "Not configured"}
                    </Badge>
                  </div>
                </div>
              </div>

              <p className="text-xs text-text-tertiary mb-4 flex-1">{meta.description}</p>

              {config?.lastTestedAt && (
                <p className="text-xs text-text-tertiary mb-2">
                  Last tested: {new Date(config.lastTestedAt).toLocaleString()}
                  {config.lastTestSuccess !== undefined && (
                    <span className={config.lastTestSuccess ? " text-success" : " text-danger"}>
                      {config.lastTestSuccess ? " (passed)" : " (failed)"}
                    </span>
                  )}
                </p>
              )}

              {testResult && (
                <div className={`mb-3 p-2 rounded-lg text-xs ${
                  testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}>
                  <div className="flex items-center gap-1">
                    {testResult.success ? (
                      <CheckCircle className="h-3 w-3 shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfiguring(meta.type)}
                >
                  <Settings className="h-3.5 w-3.5" /> Configure
                </Button>
                {config && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleMutation.mutate({
                          type: meta.type,
                          config: config.config,
                          isEnabled: !config.isEnabled,
                        })
                      }
                    >
                      <Power className="h-3.5 w-3.5" />
                      {config.isEnabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(meta.type)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger ml-auto"
                      onClick={() => {
                        if (confirm(`Remove ${meta.label} integration?`)) {
                          deleteMutation.mutate(meta.type);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {configuring && (
        <IntegrationConfigDialog
          type={configuring}
          meta={INTEGRATIONS.find((m) => m.type === configuring)!}
          existing={getConfig(configuring)}
          onClose={() => setConfiguring(null)}
          onSave={(config, isEnabled) =>
            upsertMutation.mutate({ type: configuring, config, isEnabled })
          }
          saving={upsertMutation.isPending}
        />
      )}
    </div>
  );
}

// --- Config dialog ---

function IntegrationConfigDialog({
  type,
  meta,
  existing,
  onClose,
  onSave,
  saving,
}: {
  type: IntegrationType;
  meta: IntegrationMeta;
  existing?: IntegrationConfig;
  onClose: () => void;
  onSave: (config: Record<string, unknown>, isEnabled: boolean) => void;
  saving: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(existing?.isEnabled ?? true);
  const existingConfig = existing?.config ?? {};

  // Slack
  const [slackWebhookUrl, setSlackWebhookUrl] = useState((existingConfig.webhookUrl as string) ?? "");
  const [slackChannel, setSlackChannel] = useState((existingConfig.channel as string) ?? "");
  const [slackEvents, setSlackEvents] = useState(
    ((existingConfig.events as string[]) ?? ["message.new", "conversation.created"]).join(", "),
  );

  // Teams
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState((existingConfig.webhookUrl as string) ?? "");
  const [teamsChannel, setTeamsChannel] = useState((existingConfig.channel as string) ?? "");

  // Email
  const [emailHost, setEmailHost] = useState((existingConfig.host as string) ?? "");
  const [emailPort, setEmailPort] = useState(String((existingConfig.port as number) ?? 587));
  const [emailFrom, setEmailFrom] = useState((existingConfig.from as string) ?? "");
  const [emailUsername, setEmailUsername] = useState((existingConfig.username as string) ?? "");
  const [emailPassword, setEmailPassword] = useState((existingConfig.password as string) ?? "");
  const [emailSecure, setEmailSecure] = useState((existingConfig.secure as boolean) ?? true);

  // Google Drive
  const [driveSyncFolder, setDriveSyncFolder] = useState((existingConfig.syncFolder as string) ?? "");

  // Webhook
  const [webhookUrl, setWebhookUrl] = useState((existingConfig.url as string) ?? "");
  const [webhookSecret, setWebhookSecret] = useState((existingConfig.secret as string) ?? "");
  const [webhookEvents, setWebhookEvents] = useState(
    ((existingConfig.events as string[]) ?? []).join(", "),
  );
  const [webhookMethod, setWebhookMethod] = useState((existingConfig.method as string) ?? "POST");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let config: Record<string, unknown>;

    switch (type) {
      case "slack":
        config = {
          webhookUrl: slackWebhookUrl,
          channel: slackChannel || undefined,
          events: slackEvents.split(",").map((s) => s.trim()).filter(Boolean),
        };
        break;
      case "teams":
        config = {
          webhookUrl: teamsWebhookUrl,
          channel: teamsChannel || undefined,
        };
        break;
      case "email":
        config = {
          host: emailHost,
          port: Number(emailPort),
          from: emailFrom,
          username: emailUsername || undefined,
          password: emailPassword || undefined,
          secure: emailSecure,
        };
        break;
      case "google-drive":
        config = {
          accessToken: existingConfig.accessToken,
          refreshToken: existingConfig.refreshToken,
          syncFolder: driveSyncFolder || undefined,
        };
        break;
      case "webhook":
        config = {
          url: webhookUrl,
          secret: webhookSecret || undefined,
          events: webhookEvents.split(",").map((s) => s.trim()).filter(Boolean),
          method: webhookMethod,
        };
        break;
      default:
        config = {};
    }

    onSave(config, isEnabled);
  };

  return (
    <Dialog open onClose={onClose} title={`Configure ${meta.label}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="integrationEnabled"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="integrationEnabled" className="text-sm text-text">
            Enable this integration
          </label>
        </div>

        {type === "slack" && (
          <>
            <Input
              label="Webhook URL"
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              required
            />
            <Input
              label="Channel (optional)"
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value)}
              placeholder="#general"
            />
            <Input
              label="Events (comma-separated)"
              value={slackEvents}
              onChange={(e) => setSlackEvents(e.target.value)}
              placeholder="message.new, conversation.created"
            />
          </>
        )}

        {type === "teams" && (
          <>
            <Input
              label="Webhook URL"
              value={teamsWebhookUrl}
              onChange={(e) => setTeamsWebhookUrl(e.target.value)}
              placeholder="https://outlook.office.com/webhook/..."
              required
            />
            <Input
              label="Channel (optional)"
              value={teamsChannel}
              onChange={(e) => setTeamsChannel(e.target.value)}
              placeholder="General"
            />
          </>
        )}

        {type === "email" && (
          <>
            <Input
              label="SMTP Host"
              value={emailHost}
              onChange={(e) => setEmailHost(e.target.value)}
              placeholder="smtp.example.com"
              required
            />
            <Input
              label="Port"
              type="number"
              value={emailPort}
              onChange={(e) => setEmailPort(e.target.value)}
              placeholder="587"
              required
            />
            <Input
              label="From Address"
              type="email"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="nova@example.com"
              required
            />
            <Input
              label="Username (optional)"
              value={emailUsername}
              onChange={(e) => setEmailUsername(e.target.value)}
            />
            <Input
              label="Password (optional)"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emailSecure"
                checked={emailSecure}
                onChange={(e) => setEmailSecure(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="emailSecure" className="text-sm text-text">
                Use TLS/SSL
              </label>
            </div>
          </>
        )}

        {type === "google-drive" && (
          <>
            <div className="p-3 rounded-lg bg-surface-tertiary text-xs text-text-secondary">
              {existing?.config?.accessToken
                ? "Google Drive is connected via OAuth. You can update the sync folder below."
                : "OAuth connection required. Click 'Save' to store settings, then use the Google OAuth flow to connect."}
            </div>
            <Input
              label="Sync Folder (optional)"
              value={driveSyncFolder}
              onChange={(e) => setDriveSyncFolder(e.target.value)}
              placeholder="NOVA Exports"
            />
          </>
        )}

        {type === "webhook" && (
          <>
            <Input
              label="Endpoint URL"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.example.com/webhooks/nova"
              required
            />
            <Input
              label="Secret (optional)"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_..."
            />
            <Input
              label="Events (comma-separated)"
              value={webhookEvents}
              onChange={(e) => setWebhookEvents(e.target.value)}
              placeholder="message.new, conversation.created, agent.complete"
            />
            <div>
              <label className="block text-sm font-medium text-text mb-1">HTTP Method</label>
              <select
                value={webhookMethod}
                onChange={(e) => setWebhookMethod(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
