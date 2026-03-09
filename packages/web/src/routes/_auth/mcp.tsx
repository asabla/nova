import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Puzzle,
  Plus,
  Search,
  Trash2,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Shield,
  Globe,
  Loader2,
  RefreshCw,
  Power,
  PowerOff,
  Code2,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/mcp")({
  component: McpPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpServer {
  id: string;
  name: string;
  url: string;
  description?: string;
  authType: string;
  isApproved: boolean;
  isEnabled: boolean;
  healthStatus: string | null;
  lastHealthCheckAt: string | null;
  createdAt: string;
}

interface McpTool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  isEnabled: boolean;
}

interface WhitelistEntry {
  id: string;
  urlPattern: string;
  description?: string;
  createdAt: string;
}

interface TestResult {
  connected: boolean;
  status?: number;
  latencyMs?: number;
  error?: string;
  serverInfo?: unknown;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function McpPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [showAddWhitelist, setShowAddWhitelist] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  // Fetch servers
  const { data: serversData, isLoading, isError } = useQuery({
    queryKey: ["mcp", "servers"],
    queryFn: () => api.get<{ data: McpServer[] }>("/api/mcp/servers"),
  });

  const servers = serversData?.data ?? [];
  const filtered = search
    ? servers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.url.toLowerCase().includes(search.toLowerCase()),
      )
    : servers;

  // Summary stats
  const connectedCount = servers.filter((s) => s.healthStatus === "connected").length;
  const errorCount = servers.filter((s) => s.healthStatus === "error").length;
  const pendingCount = servers.filter(
    (s) => !s.healthStatus || s.healthStatus === "pending",
  ).length;

  // Register server
  const registerServer = useMutation({
    mutationFn: (data: {
      name: string;
      url: string;
      description?: string;
      authType?: string;
    }) => api.post("/api/mcp/servers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      setShowRegister(false);
      toast(t("mcp.registered", "MCP server registered"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("mcp.registerFailed", "Failed to register server"), "error"),
  });

  // Delete server
  const deleteServer = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcp/servers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      toast(t("mcp.removed", "MCP server removed"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("mcp.removeFailed", "Failed to delete server"), "error"),
  });

  // Toggle enable/disable
  const toggleServer = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      api.patch(`/api/mcp/servers/${id}`, { isEnabled }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      toast(
        variables.isEnabled ? t("mcp.enabled", "Server enabled") : t("mcp.disabled", "Server disabled"),
        "success",
      );
    },
    onError: (err: any) =>
      toast(err.message ?? t("mcp.updateFailed", "Failed to update server"), "error"),
  });

  // Test connectivity
  const testServer = useMutation({
    mutationFn: (id: string) =>
      api.post<TestResult>(`/api/mcp/servers/${id}/test`),
    onSuccess: (data, id) => {
      setTestResults((prev) => ({ ...prev, [id]: data }));
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      if (data.connected) {
        toast(t("mcp.connected", "Connected ({{ms}}ms)", { ms: data.latencyMs }), "success");
      } else {
        toast(data.error ?? t("mcp.connectionFailed", "Connection failed"), "error");
      }
    },
    onError: (err: any) =>
      toast(err.message ?? t("mcp.testFailed", "Failed to test server"), "error"),
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Puzzle className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold text-text">{t("mcp.title", "MCP Servers")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWhitelist(true)}
            >
              <Shield className="h-3.5 w-3.5" aria-hidden="true" /> {t("mcp.whitelist", "Whitelist")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowRegister(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("mcp.addServer", "Add Server")}
            </Button>
          </div>
        </div>

        {/* Status Summary */}
        {servers.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-success/5 border border-success/20">
              <CheckCircle className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
              <div>
                <p className="text-lg font-semibold text-text">
                  {connectedCount}
                </p>
                <p className="text-xs text-text-tertiary">{t("mcp.statusConnected", "Connected")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/5 border border-danger/20">
              <XCircle className="h-4 w-4 text-danger shrink-0" aria-hidden="true" />
              <div>
                <p className="text-lg font-semibold text-text">{errorCount}</p>
                <p className="text-xs text-text-tertiary">{t("mcp.statusError", "Error")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/5 border border-warning/20">
              <Clock className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
              <div>
                <p className="text-lg font-semibold text-text">
                  {pendingCount}
                </p>
                <p className="text-xs text-text-tertiary">{t("mcp.statusPending", "Pending")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6 input-glow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("mcp.searchPlaceholder", "Search servers by name or URL...")}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary"
          />
        </div>

        {/* Server List */}
        <div className="space-y-2">
          {isError ? (
            <div className="text-center py-16">
              <XCircle className="h-10 w-10 text-danger mx-auto mb-3 opacity-60" aria-hidden="true" />
              <p className="text-sm text-danger">{t("mcp.loadError", "Failed to load MCP servers")}</p>
              <p className="text-xs text-text-tertiary mt-1">{t("common.tryAgain", "Please try again later.")}</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="h-6 w-6 text-text-tertiary mx-auto mb-3 animate-spin" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{t("mcp.loading", "Loading servers...")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Puzzle className="h-10 w-10 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-text-secondary">
                {search
                  ? t("mcp.noSearchResults", "No servers match your search")
                  : t("mcp.noServers", "No MCP servers registered")}
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                {search
                  ? t("mcp.tryDifferentSearch", "Try a different search term")
                  : t("mcp.noServersHint", "Add an MCP server to connect external tools")}
              </p>
              {!search && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowRegister(true)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("mcp.addServer", "Add Server")}
                </Button>
              )}
            </div>
          ) : (
            filtered.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                isExpanded={expandedServer === server.id}
                onToggleExpand={() =>
                  setExpandedServer(
                    expandedServer === server.id ? null : server.id,
                  )
                }
                onTest={() => testServer.mutate(server.id)}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Remove "${server.name}"? This cannot be undone.`,
                    )
                  ) {
                    deleteServer.mutate(server.id);
                  }
                }}
                onToggleEnabled={() =>
                  toggleServer.mutate({
                    id: server.id,
                    isEnabled: !server.isEnabled,
                  })
                }
                isTesting={
                  testServer.isPending && testServer.variables === server.id
                }
                testResult={testResults[server.id] ?? null}
              />
            ))
          )}
        </div>

        {/* Register Dialog */}
        <RegisterServerDialog
          open={showRegister}
          onClose={() => setShowRegister(false)}
          onSubmit={(data) => registerServer.mutate(data)}
          isPending={registerServer.isPending}
          t={t}
        />

        {/* Whitelist Dialog */}
        <WhitelistDialog
          open={showWhitelist}
          onClose={() => setShowWhitelist(false)}
          onShowAdd={() => setShowAddWhitelist(true)}
        />

        {/* Add Whitelist Entry Dialog */}
        <AddWhitelistDialog
          open={showAddWhitelist}
          onClose={() => setShowAddWhitelist(false)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server Card
// ---------------------------------------------------------------------------

function ServerCard({
  server,
  isExpanded,
  onToggleExpand,
  onTest,
  onDelete,
  onToggleEnabled,
  isTesting,
  testResult,
}: {
  server: McpServer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTest: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  isTesting: boolean;
  testResult: TestResult | null;
}) {
  const lastChecked = server.lastHealthCheckAt
    ? new Date(server.lastHealthCheckAt).toLocaleString()
    : "Never";

  return (
    <div
      className={`rounded-xl bg-surface-secondary border transition-colors ${
        server.healthStatus === "connected"
          ? "border-success/30"
          : server.healthStatus === "error"
            ? "border-danger/30"
            : "border-border"
      } hover:border-border-strong`}
    >
      {/* Main row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={onToggleExpand}
            className="text-text-tertiary hover:text-text"
            aria-label={isExpanded ? "Collapse server details" : "Expand server details"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <StatusIndicator status={server.healthStatus} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text truncate">
                {server.name}
              </span>
              {server.isApproved && <Badge variant="success">Approved</Badge>}
              {!server.isEnabled && <Badge variant="warning">Disabled</Badge>}
              <Badge variant="default">{server.authType}</Badge>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5 truncate font-mono">
              {server.url}
            </p>
            {server.description && (
              <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">
                {server.description}
              </p>
            )}
            <p className="text-xs text-text-tertiary mt-1">
              Last checked: {lastChecked}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="p-1.5 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface disabled:opacity-50"
            title="Test connectivity"
            aria-label="Test connectivity"
          >
            {isTesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={onToggleEnabled}
            className={`p-1.5 rounded-lg hover:bg-surface ${
              server.isEnabled
                ? "text-success hover:text-warning"
                : "text-text-tertiary hover:text-success"
            }`}
            title={server.isEnabled ? "Disable server" : "Enable server"}
            aria-label={server.isEnabled ? "Disable server" : "Enable server"}
          >
            {server.isEnabled ? (
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
            title="Remove server"
            aria-label="Remove server"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Inline test result */}
      {testResult && (
        <div
          className={`mx-4 mb-3 p-3 rounded-lg border text-xs ${
            testResult.connected
              ? "bg-success/5 border-success/20"
              : "bg-danger/5 border-danger/20"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {testResult.connected ? (
              <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />
            )}
            <span className="font-medium text-text">
              {testResult.connected ? "Connected" : "Connection Failed"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-text-tertiary">
            {testResult.latencyMs != null && (
              <span>Latency: {testResult.latencyMs}ms</span>
            )}
            {testResult.status != null && (
              <span>HTTP {testResult.status}</span>
            )}
            {testResult.error && (
              <span className="text-danger">{testResult.error}</span>
            )}
          </div>
          {testResult.serverInfo ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-text-secondary hover:text-text">
                Server Info
              </summary>
              <pre className="mt-1 p-2 rounded bg-surface text-text-secondary overflow-auto max-h-32 font-mono">
                {JSON.stringify(testResult.serverInfo, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      )}

      {/* Expanded tools section */}
      {isExpanded && <ServerToolsList serverId={server.id} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Indicator
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: string | null }) {
  switch (status) {
    case "connected":
      return (
        <div className="relative shrink-0">
          <CheckCircle className="h-4 w-4 text-success" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
        </div>
      );
    case "error":
      return <XCircle className="h-4 w-4 text-danger shrink-0" />;
    case "pending":
      return <Clock className="h-4 w-4 text-warning shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-text-tertiary shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Tools List (loaded when a server card is expanded)
// ---------------------------------------------------------------------------

function ServerToolsList({ serverId }: { serverId: string }) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mcp", "servers", serverId, "tools"],
    queryFn: () =>
      api.get<{ data: McpTool[] }>(`/api/mcp/servers/${serverId}/tools`),
  });

  const tools = data?.data ?? [];

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          Available Tools ({tools.length})
        </span>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text p-1 rounded disabled:opacity-50"
          title="Refresh tools list from server"
        >
          <RefreshCw
            className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
          <span className="text-xs text-text-tertiary">
            Discovering tools...
          </span>
        </div>
      ) : tools.length === 0 ? (
        <div className="text-center py-4">
          <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1.5" />
          <p className="text-xs text-text-tertiary">
            No tools discovered. Test connectivity first, then refresh.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {tools.map((tool) => (
            <ToolItem
              key={tool.id}
              tool={tool}
              isExpanded={expandedTool === tool.id}
              onToggle={() =>
                setExpandedTool(expandedTool === tool.id ? null : tool.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual Tool Item (expandable to show schema)
// ---------------------------------------------------------------------------

function ToolItem({
  tool,
  isExpanded,
  onToggle,
}: {
  tool: McpTool;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasSchema =
    tool.inputSchema &&
    typeof tool.inputSchema === "object" &&
    Object.keys(tool.inputSchema).length > 0;

  const schemaProperties =
    hasSchema && (tool.inputSchema as any)?.properties
      ? Object.entries((tool.inputSchema as any).properties)
      : [];

  const requiredFields: string[] =
    hasSchema && Array.isArray((tool.inputSchema as any)?.required)
      ? (tool.inputSchema as any).required
      : [];

  return (
    <div className="rounded-lg border border-transparent hover:border-border hover:bg-surface transition-colors">
      <button
        onClick={onToggle}
        className="flex items-start gap-2 p-2 w-full text-left"
      >
        <Globe className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text font-mono">
              {tool.name}
            </span>
            {!tool.isEnabled && (
              <Badge variant="warning" className="shrink-0">
                Disabled
              </Badge>
            )}
            {hasSchema && (
              <Code2 className="h-3 w-3 text-text-tertiary shrink-0 ml-auto" />
            )}
          </div>
          {tool.description && (
            <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
              {tool.description}
            </p>
          )}
        </div>
      </button>

      {/* Expanded schema view */}
      {isExpanded && hasSchema && (
        <div className="px-2 pb-2 ml-6">
          {schemaProperties.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Parameters
              </p>
              {schemaProperties.map(([paramName, paramSchema]: [string, any]) => (
                <div
                  key={paramName}
                  className="flex items-start gap-2 p-2 rounded bg-surface border border-border text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono font-medium text-text">
                        {paramName}
                      </code>
                      <span className="text-text-tertiary">
                        {paramSchema?.type ?? "any"}
                      </span>
                      {requiredFields.includes(paramName) && (
                        <span className="text-danger text-[10px] font-medium">
                          required
                        </span>
                      )}
                    </div>
                    {paramSchema?.description && (
                      <p className="text-text-tertiary mt-0.5">
                        {paramSchema.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <details>
              <summary className="text-xs text-text-secondary cursor-pointer hover:text-text">
                Raw Schema
              </summary>
              <pre className="mt-1 p-2 rounded bg-surface text-xs text-text-tertiary font-mono overflow-auto max-h-40 border border-border">
                {JSON.stringify(tool.inputSchema, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Server Dialog (#150 - Add MCP server by URL)
// ---------------------------------------------------------------------------

function RegisterServerDialog({
  open,
  onClose,
  t,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    url: string;
    description?: string;
    authType?: string;
  }) => void;
  isPending: boolean;
  t: any;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [authType, setAuthType] = useState<"none" | "bearer" | "api_key">(
    "none",
  );
  const [authToken, setAuthToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      url,
      description: description || undefined,
      authType,
    });
  };

  const handleClose = () => {
    setName("");
    setUrl("");
    setDescription("");
    setAuthType("none");
    setAuthToken("");
    setShowToken(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title="Add MCP Server">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="My MCP Server"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Server URL"
          type="url"
          placeholder="https://mcp.example.com/sse"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of this server and its capabilities..."
          rows={2}
        />

        {/* Auth section */}
        <Select
          label="Authentication"
          options={[
            { value: "none", label: "None" },
            { value: "bearer", label: "Bearer Token" },
            { value: "api_key", label: "API Key" },
          ]}
          value={authType}
          onChange={(val) =>
            setAuthType(val as "none" | "bearer" | "api_key")
          }
        />

        {authType !== "none" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">
              {authType === "bearer" ? "Bearer Token" : "API Key"}
            </label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder={
                  authType === "bearer"
                    ? "eyJhbGciOiJIUzI1NiIs..."
                    : "sk-..."
                }
                className="pr-20 font-mono"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1 text-text-tertiary hover:text-text rounded"
                  title={showToken ? "Hide" : "Show"}
                >
                  {showToken ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(authToken);
                    toast("Copied to clipboard", "success");
                  }}
                  className="p-1 text-text-tertiary hover:text-text rounded"
                  title="Copy"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-text-tertiary">
              The token will be sent with each request to the MCP server.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            {t("mcp.addServer", "Add Server")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Whitelist Dialog (#152 - Admin whitelist approved MCP server URLs)
// ---------------------------------------------------------------------------

function WhitelistDialog({
  open,
  onClose,
  onShowAdd,
}: {
  open: boolean;
  onClose: () => void;
  onShowAdd: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: whitelistData, isLoading } = useQuery({
    queryKey: ["mcp", "whitelist"],
    queryFn: () =>
      api.get<{ data: WhitelistEntry[] }>("/api/mcp/whitelist"),
    enabled: open,
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcp/whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "whitelist"] });
      toast("Whitelist entry removed", "success");
    },
    onError: (err: any) =>
      toast(err.message ?? "Failed to remove entry", "error"),
  });

  const entries = whitelistData?.data ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Approved MCP Server URLs"
      className="max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-text-secondary">
            Only servers matching whitelisted URL patterns can be registered by
            non-admin users. Admins can always register any server. Patterns
            support wildcards (e.g., <code>https://*.example.com/*</code>).
          </p>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onShowAdd}>
            <Plus className="h-3.5 w-3.5" /> Add Pattern
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6">
            <Shield className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">
              No whitelist entries yet
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              All servers are currently blocked for non-admin users
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-xs font-mono text-text">
                    {entry.urlPattern}
                  </code>
                  {entry.description && (
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {entry.description}
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Added {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove this whitelist entry? Non-admin users will no longer be able to register servers matching this pattern.",
                      )
                    ) {
                      deleteEntry.mutate(entry.id);
                    }
                  }}
                  disabled={deleteEntry.isPending}
                  className="p-1 text-text-tertiary hover:text-danger rounded ml-2 shrink-0 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add Whitelist Entry Dialog
// ---------------------------------------------------------------------------

function AddWhitelistDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [urlPattern, setUrlPattern] = useState("");
  const [description, setDescription] = useState("");

  const addEntry = useMutation({
    mutationFn: (data: { urlPattern: string; description?: string }) =>
      api.post("/api/mcp/whitelist", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "whitelist"] });
      setUrlPattern("");
      setDescription("");
      onClose();
      toast("Whitelist entry added", "success");
    },
    onError: (err: any) =>
      toast(err.message ?? "Failed to add entry", "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEntry.mutate({
      urlPattern,
      description: description || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Whitelist Pattern">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label="URL Pattern"
            placeholder="https://*.example.com/*"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            required
          />
          <p className="text-xs text-text-tertiary mt-1">
            Use <code>*</code> as wildcard. Example:{" "}
            <code>https://*.company.com/mcp/*</code>
          </p>
        </div>
        <Input
          label="Description"
          placeholder="Allow all company.com MCP servers"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={addEntry.isPending}>
            Add Pattern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
