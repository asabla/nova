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
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
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
  inputSchema?: unknown;
  isEnabled: boolean;
}

interface WhitelistEntry {
  id: string;
  urlPattern: string;
  description?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function McpPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [showWhitelist, setShowWhitelist] = useState(false);
  const [showAddWhitelist, setShowAddWhitelist] = useState(false);

  // Fetch servers
  const { data: serversData, isLoading } = useQuery({
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

  // Register server
  const registerServer = useMutation({
    mutationFn: (data: { name: string; url: string; description?: string }) =>
      api.post("/api/mcp/servers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      setShowRegister(false);
      toast("MCP server registered", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to register server", "error"),
  });

  // Delete server
  const deleteServer = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcp/servers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      toast("MCP server removed", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to delete server", "error"),
  });

  // Test connectivity
  const testServer = useMutation({
    mutationFn: (id: string) =>
      api.post<{ connected: boolean; status?: number; latencyMs?: number; error?: string }>(
        `/api/mcp/servers/${id}/test`,
      ),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "servers"] });
      if (data.connected) {
        toast(`Connected (${data.latencyMs}ms)`, "success");
      } else {
        toast(data.error ?? "Connection failed", "error");
      }
    },
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Puzzle className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-text">MCP Servers</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowWhitelist(true)}>
              <Shield className="h-3.5 w-3.5" /> Whitelist
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowRegister(true)}>
              <Plus className="h-3.5 w-3.5" /> Register Server
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>

        {/* Server List */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="h-6 w-6 text-text-tertiary mx-auto mb-3 animate-spin" />
              <p className="text-sm text-text-secondary">Loading servers...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Puzzle className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No MCP servers registered</p>
              <p className="text-xs text-text-tertiary mt-1">
                Register an MCP server to connect external tools
              </p>
            </div>
          ) : (
            filtered.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                isExpanded={expandedServer === server.id}
                onToggleExpand={() =>
                  setExpandedServer(expandedServer === server.id ? null : server.id)
                }
                onTest={() => testServer.mutate(server.id)}
                onDelete={() => deleteServer.mutate(server.id)}
                isTesting={testServer.isPending && testServer.variables === server.id}
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
  isTesting,
}: {
  server: McpServer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTest: () => void;
  onDelete: () => void;
  isTesting: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onToggleExpand} className="text-text-tertiary hover:text-text">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <StatusIndicator status={server.healthStatus} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text truncate">{server.name}</span>
              {server.isApproved && <Badge variant="success">Approved</Badge>}
              {!server.isEnabled && <Badge variant="warning">Disabled</Badge>}
              <Badge variant="default">{server.authType}</Badge>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5 truncate">{server.url}</p>
            {server.description && (
              <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">
                {server.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <button
            onClick={onTest}
            disabled={isTesting}
            className="p-1.5 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface disabled:opacity-50"
            title="Test connectivity"
          >
            {isTesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
            title="Remove server"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

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
      return <CheckCircle className="h-4 w-4 text-success shrink-0" />;
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mcp", "servers", serverId, "tools"],
    queryFn: () => api.get<{ data: McpTool[] }>(`/api/mcp/servers/${serverId}/tools`),
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
          className="text-text-tertiary hover:text-text p-1 rounded"
          title="Refresh tools"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-text-tertiary" />
          <span className="text-xs text-text-tertiary">Fetching tools...</span>
        </div>
      ) : tools.length === 0 ? (
        <p className="text-xs text-text-tertiary py-2">
          No tools discovered. Test connectivity first, then refresh.
        </p>
      ) : (
        <div className="space-y-1">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-text">{tool.name}</span>
                {tool.description && (
                  <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                    {tool.description}
                  </p>
                )}
              </div>
              {!tool.isEnabled && (
                <Badge variant="warning" className="ml-auto shrink-0">
                  Disabled
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Server Dialog
// ---------------------------------------------------------------------------

function RegisterServerDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; url: string; description?: string }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, url, description: description || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Register MCP Server">
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this server..."
            rows={3}
            className="p-3 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary resize-y focus:outline-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            Register
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Whitelist Dialog
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
    queryFn: () => api.get<{ data: WhitelistEntry[] }>("/api/mcp/whitelist"),
    enabled: open,
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => api.delete(`/api/mcp/whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp", "whitelist"] });
      toast("Whitelist entry removed", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to remove entry", "error"),
  });

  const entries = whitelistData?.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} title="URL Whitelist" className="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-text-tertiary">
          Only servers matching whitelisted URL patterns can be registered by non-admin users.
        </p>

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
            <p className="text-xs text-text-tertiary">No whitelist entries</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-xs font-mono text-text">{entry.urlPattern}</code>
                  {entry.description && (
                    <p className="text-xs text-text-tertiary mt-0.5">{entry.description}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry.mutate(entry.id)}
                  className="p-1 text-text-tertiary hover:text-danger rounded ml-2 shrink-0"
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
    onError: (err: any) => toast(err.message ?? "Failed to add entry", "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addEntry.mutate({ urlPattern, description: description || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Whitelist Pattern">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="URL Pattern"
          placeholder="https://*.example.com/*"
          value={urlPattern}
          onChange={(e) => setUrlPattern(e.target.value)}
          required
        />
        <Input
          label="Description"
          placeholder="Allow all example.com subdomains"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={addEntry.isPending}>
            Add
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
