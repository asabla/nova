import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Search, Pencil, Trash2, Play, CheckCircle, XCircle, Code2, Globe, Puzzle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/tools")({
  component: ToolsPage,
});

function ToolsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showTest, setShowTest] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("{}");
  const [testResult, setTestResult] = useState<any>(null);

  const { data: tools } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<any>("/api/tools"),
  });

  const createTool = useMutation({
    mutationFn: (data: any) => api.post("/api/tools", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      setShowCreate(false);
      toast("Tool created", "success");
    },
  });

  const deleteTool = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tools/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      toast("Tool deleted", "success");
    },
  });

  const testTool = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: string }) => {
      const parsed = JSON.parse(input);
      return api.post<any>(`/api/tools/${id}/test`, { input: parsed });
    },
    onSuccess: (data) => setTestResult(data),
    onError: (err: any) => setTestResult({ success: false, error: err.message }),
  });

  const toolList = (tools as any)?.data ?? [];
  const filtered = search
    ? toolList.filter((t: any) => t.name.toLowerCase().includes(search.toLowerCase()))
    : toolList;

  const typeIcon = (type: string) => {
    switch (type) {
      case "function": return <Code2 className="h-4 w-4 text-blue-400" />;
      case "openapi": return <Globe className="h-4 w-4 text-green-400" />;
      case "mcp": return <Puzzle className="h-4 w-4 text-purple-400" />;
      default: return <Wrench className="h-4 w-4 text-text-tertiary" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wrench className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-text">Tools</h1>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> Register Tool
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>

        {/* Tools List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Wrench className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No tools registered</p>
              <p className="text-xs text-text-tertiary mt-1">Register custom tools for agents to use</p>
            </div>
          ) : (
            filtered.map((tool: any) => (
              <div key={tool.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors">
                <div className="flex items-center gap-3">
                  {typeIcon(tool.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{tool.name}</span>
                      <Badge variant="default">{tool.type}</Badge>
                      {tool.isApproved && <Badge variant="success">Approved</Badge>}
                      {!tool.isEnabled && <Badge variant="warning">Disabled</Badge>}
                    </div>
                    {tool.description && (
                      <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{tool.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setShowTest(tool.id); setTestResult(null); }}
                    className="p-1.5 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface"
                    title="Test"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteTool.mutate(tool.id)}
                    className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Dialog */}
        <CreateToolDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createTool.mutate(data)}
          isPending={createTool.isPending}
        />

        {/* Test Dialog */}
        <Dialog open={!!showTest} onClose={() => setShowTest(null)} title="Test Tool">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Input (JSON)</label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={5}
                className="w-full p-3 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => showTest && testTool.mutate({ id: showTest, input: testInput })}
              loading={testTool.isPending}
            >
              <Play className="h-3.5 w-3.5" /> Execute
            </Button>
            {testResult && (
              <div className={`p-3 rounded-lg border ${testResult.success ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? <CheckCircle className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
                  <span className="text-xs font-medium text-text">
                    {testResult.success ? "Success" : "Failed"} ({testResult.latencyMs}ms)
                  </span>
                </div>
                <pre className="text-xs text-text-secondary overflow-auto max-h-40">
                  {JSON.stringify(testResult.result ?? testResult.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Dialog>
      </div>
    </div>
  );
}

function CreateToolDialog({ open, onClose, onSubmit, isPending }: {
  open: boolean; onClose: () => void; onSubmit: (data: any) => void; isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("function");
  const [endpoint, setEndpoint] = useState("");
  const [schema, setSchema] = useState("{}");

  return (
    <Dialog open={open} onClose={onClose} title="Register Tool">
      <form onSubmit={(e) => {
        e.preventDefault();
        const data: any = { name, description, type };
        if (endpoint) data.endpoint = endpoint;
        try { data.schema = JSON.parse(schema); } catch { data.schema = {}; }
        onSubmit(data);
      }} className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-text mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text">
            <option value="function">Function</option>
            <option value="openapi">OpenAPI</option>
            <option value="mcp">MCP Server</option>
          </select>
        </div>
        {type === "openapi" && <Input label="Endpoint URL" type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Schema (JSON)</label>
          <textarea value={schema} onChange={(e) => setSchema(e.target.value)} rows={4}
            className="w-full p-2 text-sm bg-surface border border-border rounded-lg text-text font-mono resize-y" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={isPending}>Create</Button>
        </div>
      </form>
    </Dialog>
  );
}
