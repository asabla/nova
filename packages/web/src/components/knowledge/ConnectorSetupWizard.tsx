import { useState, useCallback } from "react";
import {
  Cloud,
  HardDrive,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Dialog } from "../ui/Dialog";
import { toast } from "../ui/Toast";
import { api } from "../../lib/api";

interface ConnectorSetupWizardProps {
  collectionId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Provider = "sharepoint" | "onedrive" | "teams" | "github" | "gitlab" | "git";

const GIT_PROVIDERS = new Set<Provider>(["github", "gitlab", "git"]);
function isGitProvider(p: Provider | null): boolean {
  return p !== null && GIT_PROVIDERS.has(p);
}

type Step = "provider" | "credentials" | "resource" | "configure" | "confirm";

interface WizardState {
  provider: Provider | null;
  // M365 fields
  tenantId: string;
  clientId: string;
  clientSecret: string;
  credentialsValid: boolean;
  resourceId: string;
  resourcePath: string;
  resourceName: string;
  syncIntervalMinutes: number;
  folderFilter: string;
  // Git fields
  repoUrl: string;
  branch: string;
  authToken: string;
  includeGlobs: string;
  excludeGlobs: string;
  repoValid: boolean;
  repoError: string;
  detectedBranch: string;
}

const PROVIDERS: Array<{
  id: Provider;
  label: string;
  description: string;
  icon: React.ReactNode;
  group: "git" | "m365";
}> = [
  {
    id: "github",
    label: "GitHub",
    description: "Sync code from a GitHub repository",
    icon: <GitBranch className="h-5 w-5" />,
    group: "git",
  },
  {
    id: "gitlab",
    label: "GitLab",
    description: "Sync code from a GitLab repository",
    icon: <GitBranch className="h-5 w-5" />,
    group: "git",
  },
  {
    id: "git",
    label: "Git URL",
    description: "Sync code from any git repository URL",
    icon: <GitBranch className="h-5 w-5" />,
    group: "git",
  },
  {
    id: "sharepoint",
    label: "SharePoint",
    description: "Sync documents from a SharePoint site's document library",
    icon: <Cloud className="h-5 w-5" />,
    group: "m365",
  },
  {
    id: "onedrive",
    label: "OneDrive",
    description: "Sync files from a OneDrive for Business folder",
    icon: <HardDrive className="h-5 w-5" />,
    group: "m365",
  },
  {
    id: "teams",
    label: "Teams",
    description: "Ingest channel messages from a Microsoft Teams channel",
    icon: <MessageSquare className="h-5 w-5" />,
    group: "m365",
  },
];

const INTERVAL_OPTIONS = [
  { value: "60", label: "Every hour" },
  { value: "180", label: "Every 3 hours" },
  { value: "360", label: "Every 6 hours" },
  { value: "720", label: "Every 12 hours" },
  { value: "1440", label: "Every 24 hours" },
];

export function ConnectorSetupWizard({
  collectionId,
  onClose,
  onCreated,
}: ConnectorSetupWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("provider");
  const [state, setState] = useState<WizardState>({
    provider: null,
    tenantId: "",
    clientId: "",
    clientSecret: "",
    credentialsValid: false,
    resourceId: "",
    resourcePath: "",
    resourceName: "",
    syncIntervalMinutes: 360,
    folderFilter: "",
    repoUrl: "",
    branch: "",
    authToken: "",
    includeGlobs: "",
    excludeGlobs: "",
    repoValid: false,
    repoError: "",
    detectedBranch: "",
  });

  const update = useCallback(
    (partial: Partial<WizardState>) => setState((prev) => ({ ...prev, ...partial })),
    [],
  );

  const isGit = isGitProvider(state.provider);

  // Steps differ by provider type
  const steps: Step[] = isGit
    ? ["provider", "resource", "configure", "confirm"]
    : ["provider", "credentials", "resource", "configure", "confirm"];
  const stepIndex = steps.indexOf(step);

  // Validate git repo URL
  const validateRepoMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ valid: boolean; defaultBranch?: string; error?: string }>(
        `/api/knowledge/connectors/git/validate`,
        { repoUrl: state.repoUrl, authToken: state.authToken || undefined },
      );
      return res as unknown as { valid: boolean; defaultBranch?: string; error?: string };
    },
    onSuccess: (data) => {
      if (data.valid) {
        update({
          repoValid: true,
          repoError: "",
          detectedBranch: data.defaultBranch ?? "main",
          branch: state.branch || data.defaultBranch || "main",
        });
        toast.success("Repository accessible");
      } else {
        update({ repoValid: false, repoError: data.error ?? "Could not access repository" });
      }
    },
    onError: (err: any) => {
      const msg = err?.error ?? err?.message ?? "Validation failed";
      update({ repoValid: false, repoError: msg });
    },
  });

  // Credential test for M365
  const testCredentials = useMutation({
    mutationFn: async () => {
      if (!state.tenantId || !state.clientId || !state.clientSecret) {
        throw new Error("All fields are required");
      }
      return { success: true };
    },
    onSuccess: () => {
      update({ credentialsValid: true });
      toast.success("Credentials look good");
    },
    onError: (err: any) => toast.error(err.message ?? "Invalid credentials"),
  });

  // Create connector
  const createMutation = useMutation({
    mutationFn: () => {
      if (isGit) {
        return api.post(`/api/knowledge/${collectionId}/connectors`, {
          provider: state.provider,
          repoUrl: state.repoUrl,
          branch: state.branch || state.detectedBranch || "main",
          authToken: state.authToken || undefined,
          resourceName: state.resourceName || undefined,
          syncIntervalMinutes: state.syncIntervalMinutes,
          includeGlobs: state.includeGlobs
            ? state.includeGlobs.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          excludeGlobs: state.excludeGlobs
            ? state.excludeGlobs.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
        });
      }
      return api.post(`/api/knowledge/${collectionId}/connectors`, {
        provider: state.provider,
        tenantId: state.tenantId,
        clientId: state.clientId,
        clientSecret: state.clientSecret,
        resourceId: state.resourceId,
        resourcePath: state.resourcePath || undefined,
        resourceName: state.resourceName || undefined,
        syncIntervalMinutes: state.syncIntervalMinutes,
        folderFilter: state.folderFilter || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Source connected successfully");
      onCreated();
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to create connector"),
  });

  const canGoNext = () => {
    switch (step) {
      case "provider":
        return !!state.provider;
      case "credentials":
        return !!state.tenantId && !!state.clientId && !!state.clientSecret;
      case "resource":
        if (isGit) return !!state.repoUrl.trim();
        return !!state.resourceId;
      case "configure":
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("knowledge.sources.wizardTitle", { defaultValue: "Add Source" })}
    >
      <div className="min-h-[320px]">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-5 text-xs text-text-tertiary">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span
                className={
                  i === stepIndex
                    ? "text-primary font-medium"
                    : i < stepIndex
                      ? "text-text-secondary"
                      : ""
                }
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            </span>
          ))}
        </div>

        {/* Step 1: Provider */}
        {step === "provider" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Git Repositories</h4>
              <div className="space-y-2">
                {PROVIDERS.filter((p) => p.group === "git").map((p) => (
                  <button
                    key={p.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      state.provider === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => update({ provider: p.id })}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        state.provider === p.id
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-secondary text-text-secondary"
                      }`}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text">{p.label}</div>
                      <div className="text-xs text-text-secondary">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Microsoft 365</h4>
              <div className="space-y-2">
                {PROVIDERS.filter((p) => p.group === "m365").map((p) => (
                  <button
                    key={p.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      state.provider === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => update({ provider: p.id })}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                        state.provider === p.id
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-secondary text-text-secondary"
                      }`}
                    >
                      {p.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text">{p.label}</div>
                      <div className="text-xs text-text-secondary">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 (M365 only): Credentials */}
        {step === "credentials" && !isGit && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Enter your Azure AD App Registration details. The app needs appropriate
              Microsoft Graph API permissions for{" "}
              {state.provider === "sharepoint"
                ? "SharePoint (Sites.Selected or Sites.Read.All)"
                : state.provider === "onedrive"
                  ? "OneDrive (Files.Read.All)"
                  : "Teams (ChannelMessage.Read.All, Team.ReadBasic.All)"}
              .
            </p>
            <Input
              label="Tenant ID"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={state.tenantId}
              onChange={(e) => update({ tenantId: e.target.value, credentialsValid: false })}
              required
            />
            <Input
              label="Client ID (Application ID)"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={state.clientId}
              onChange={(e) => update({ clientId: e.target.value, credentialsValid: false })}
              required
            />
            <Input
              label="Client Secret"
              type="password"
              placeholder="Client secret value"
              value={state.clientSecret}
              onChange={(e) => update({ clientSecret: e.target.value, credentialsValid: false })}
              required
            />
            {state.credentialsValid && (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Credentials validated
              </div>
            )}
          </div>
        )}

        {/* Resource step — Git */}
        {step === "resource" && isGit && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Enter the repository URL. For private repos, provide a personal access token.
            </p>
            <Input
              label="Repository URL"
              placeholder={
                state.provider === "github"
                  ? "https://github.com/owner/repo"
                  : state.provider === "gitlab"
                    ? "https://gitlab.com/owner/repo"
                    : "https://example.com/repo.git"
              }
              value={state.repoUrl}
              onChange={(e) => update({ repoUrl: e.target.value, repoValid: false, repoError: "" })}
              required
            />
            <Input
              label="Access Token (optional for public repos)"
              type="password"
              placeholder={
                state.provider === "github"
                  ? "ghp_xxxxxxxxxxxxxxxxxxxx"
                  : state.provider === "gitlab"
                    ? "glpat-xxxxxxxxxxxxxxxxxxxx"
                    : "Token"
              }
              value={state.authToken}
              onChange={(e) => update({ authToken: e.target.value, repoValid: false, repoError: "" })}
            />
            <Input
              label="Display Name (optional)"
              placeholder="e.g. My Project"
              value={state.resourceName}
              onChange={(e) => update({ resourceName: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => validateRepoMutation.mutate()}
                disabled={!state.repoUrl.trim() || validateRepoMutation.isPending}
              >
                {validateRepoMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating...</>
                ) : (
                  "Validate"
                )}
              </Button>
              {state.repoValid && (
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accessible{state.detectedBranch ? ` (default: ${state.detectedBranch})` : ""}
                </span>
              )}
              {state.repoError && (
                <span className="flex items-center gap-1.5 text-xs text-danger">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {state.repoError}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Resource step — M365 */}
        {step === "resource" && !isGit && (
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              {state.provider === "sharepoint"
                ? "Enter the SharePoint Site ID. You can find this in SharePoint Admin Center or via the Graph API."
                : state.provider === "onedrive"
                  ? "Enter the Drive ID for the OneDrive you want to sync."
                  : "Enter the Team ID and select a channel."}
            </p>
            <Input
              label={
                state.provider === "sharepoint"
                  ? "Site ID"
                  : state.provider === "onedrive"
                    ? "Drive ID"
                    : "Team ID"
              }
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={state.resourceId}
              onChange={(e) => update({ resourceId: e.target.value })}
              required
            />
            {state.provider === "teams" && (
              <Input
                label="Channel ID"
                placeholder="19:xxxxxx@thread.tacv2"
                value={state.resourcePath}
                onChange={(e) => update({ resourcePath: e.target.value })}
                required
              />
            )}
            {state.provider === "sharepoint" && (
              <Input
                label="Document Library Name (optional)"
                placeholder="Shared Documents"
                value={state.resourcePath}
                onChange={(e) => update({ resourcePath: e.target.value })}
              />
            )}
            <Input
              label="Display Name (optional)"
              placeholder="e.g. Marketing Site, Project Docs"
              value={state.resourceName}
              onChange={(e) => update({ resourceName: e.target.value })}
            />
          </div>
        )}

        {/* Configure step */}
        {step === "configure" && (
          <div className="space-y-4">
            {isGit && (
              <>
                <Input
                  label="Branch"
                  placeholder={state.detectedBranch || "main"}
                  value={state.branch}
                  onChange={(e) => update({ branch: e.target.value })}
                />
                <Input
                  label="Include Globs (optional, comma-separated)"
                  placeholder="e.g. src/**/*.ts, lib/**/*.py"
                  value={state.includeGlobs}
                  onChange={(e) => update({ includeGlobs: e.target.value })}
                />
                <Input
                  label="Exclude Globs (optional, comma-separated)"
                  placeholder="e.g. tests/**, docs/**"
                  value={state.excludeGlobs}
                  onChange={(e) => update({ excludeGlobs: e.target.value })}
                />
              </>
            )}
            <Select
              label="Sync Frequency"
              value={String(state.syncIntervalMinutes)}
              onChange={(value) =>
                update({ syncIntervalMinutes: parseInt(value, 10) })
              }
              options={INTERVAL_OPTIONS}
            />
            {!isGit && state.provider !== "teams" && (
              <Input
                label="Folder Filter (optional)"
                placeholder="e.g. /Reports/2024"
                value={state.folderFilter}
                onChange={(e) => update({ folderFilter: e.target.value })}
              />
            )}
          </div>
        )}

        {/* Confirm step */}
        {step === "confirm" && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text">Review Configuration</h4>
            <div className="bg-surface-secondary rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Provider</span>
                <span className="text-text font-medium">
                  {PROVIDERS.find((p) => p.id === state.provider)?.label}
                </span>
              </div>
              {isGit ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Repository</span>
                    <span className="text-text font-mono text-xs truncate max-w-[240px]">
                      {state.repoUrl}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Branch</span>
                    <span className="text-text">
                      {state.branch || state.detectedBranch || "main"}
                    </span>
                  </div>
                  {state.authToken && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Auth</span>
                      <span className="text-text">Token provided</span>
                    </div>
                  )}
                  {state.includeGlobs && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Include</span>
                      <span className="text-text text-xs truncate max-w-[240px]">{state.includeGlobs}</span>
                    </div>
                  )}
                  {state.excludeGlobs && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Exclude</span>
                      <span className="text-text text-xs truncate max-w-[240px]">{state.excludeGlobs}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Tenant</span>
                    <span className="text-text font-mono text-xs">
                      {state.tenantId.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Resource</span>
                    <span className="text-text">
                      {state.resourceName || state.resourceId.slice(0, 12) + "..."}
                    </span>
                  </div>
                  {state.folderFilter && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Folder Filter</span>
                      <span className="text-text">{state.folderFilter}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">Sync Interval</span>
                <span className="text-text">
                  {INTERVAL_OPTIONS.find(
                    (o) => o.value === String(state.syncIntervalMinutes),
                  )?.label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between mt-4 pt-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={stepIndex === 0 ? onClose : () => setStep(steps[stepIndex - 1])}
        >
          {stepIndex === 0 ? (
            t("common.cancel", { defaultValue: "Cancel" })
          ) : (
            <>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
            </>
          )}
        </Button>

        {step === "confirm" ? (
          <Button
            variant="primary"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Connect
              </>
            )}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => setStep(steps[stepIndex + 1])}
            disabled={!canGoNext()}
          >
            Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </Dialog>
  );
}
