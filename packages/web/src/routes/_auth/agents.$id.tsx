import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ArrowLeft, Save, Trash2, Copy, Share2, History, TestTube, Settings2, Wrench, BookOpen, Brain } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/agents/$id")({
  component: AgentDetailPage,
});

function AgentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"config" | "tools" | "knowledge" | "memory" | "test">("config");

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => api.get<any>(`/api/agents/${id}`),
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    visibility: "private",
    toolApprovalMode: "always-ask",
    memoryScope: "per-user",
  });

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name ?? "",
        description: agent.description ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        visibility: agent.visibility ?? "private",
        toolApprovalMode: agent.toolApprovalMode ?? "always-ask",
        memoryScope: agent.memoryScope ?? "per-user",
      });
    }
  }, [agent]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.patch(`/api/agents/${id}`, data),
    onSuccess: () => {
      toast.success("Agent updated");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/agents/${id}`),
    onSuccess: () => {
      toast.success("Agent deleted");
      navigate({ to: "/agents" });
    },
    onError: (err: any) => toast.error(err.message ?? "Delete failed"),
  });

  const cloneMutation = useMutation({
    mutationFn: () => api.post("/api/agents", {
      name: `${form.name} (Copy)`,
      description: form.description,
      systemPrompt: form.systemPrompt,
      visibility: "private",
      toolApprovalMode: form.toolApprovalMode,
      memoryScope: form.memoryScope,
    }),
    onSuccess: (data: any) => {
      toast.success("Agent cloned");
      navigate({ to: "/agents/$id", params: { id: data.id } });
    },
  });

  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestResult("");
    try {
      const result = await api.post<any>("/api/v1/chat/completions", {
        model: "gpt-4o",
        messages: [
          ...(form.systemPrompt ? [{ role: "system", content: form.systemPrompt }] : []),
          { role: "user", content: testPrompt },
        ],
      });
      setTestResult(result.choices?.[0]?.message?.content ?? "No response");
    } catch (err: any) {
      setTestResult(`Error: ${err.message ?? "Test failed"}`);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-secondary">Loading agent...</div>
      </div>
    );
  }

  const tabs = [
    { id: "config" as const, label: "Configuration", icon: Settings2 },
    { id: "tools" as const, label: "Tools", icon: Wrench },
    { id: "knowledge" as const, label: "Knowledge", icon: BookOpen },
    { id: "memory" as const, label: "Memory", icon: Brain },
    { id: "test" as const, label: "Test", icon: TestTube },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/agents" })} className="p-1 hover:bg-surface-secondary rounded">
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="text-lg font-semibold text-text bg-transparent border-none outline-none"
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description..."
              className="text-sm text-text-secondary bg-transparent border-none outline-none block placeholder:text-text-tertiary"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => cloneMutation.mutate()}>
            <Copy className="h-3.5 w-3.5" /> Clone
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={() => {
              if (confirm("Delete this agent?")) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button
            variant="primary"
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-text-secondary hover:text-text hover:bg-surface-secondary"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === "config" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">System Prompt</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                placeholder="You are a helpful assistant..."
                rows={8}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Visibility</label>
                <select
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                >
                  <option value="private">Private</option>
                  <option value="team">Team</option>
                  <option value="org">Organization</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Tool Approval</label>
                <select
                  value={form.toolApprovalMode}
                  onChange={(e) => setForm({ ...form, toolApprovalMode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                >
                  <option value="auto">Auto-approve</option>
                  <option value="always-ask">Always ask</option>
                  <option value="never">Never allow</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Memory Scope</label>
              <select
                value={form.memoryScope}
                onChange={(e) => setForm({ ...form, memoryScope: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
              >
                <option value="per-user">Per user</option>
                <option value="per-conversation">Per conversation</option>
                <option value="global">Global</option>
              </select>
            </div>

            {agent && (
              <div className="pt-4 border-t border-border text-xs text-text-tertiary space-y-1">
                <p>Version: {agent.currentVersion}</p>
                <p>Created: {new Date(agent.createdAt).toLocaleDateString()}</p>
                <p>Updated: {new Date(agent.updatedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "test" && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">Test Prompt</label>
              <div className="flex gap-2">
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Enter a test message..."
                  rows={3}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm"
                />
                <Button variant="primary" onClick={handleTest} disabled={testing || !testPrompt.trim()}>
                  <TestTube className="h-4 w-4" />
                  {testing ? "Running..." : "Test"}
                </Button>
              </div>
            </div>
            {testResult && (
              <div className="px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm text-text whitespace-pre-wrap">
                {testResult}
              </div>
            )}
          </div>
        )}

        {activeTab === "tools" && <AgentToolsTab agentId={id} />}
        {activeTab === "knowledge" && <AgentKnowledgeTab agentId={id} />}
        {activeTab === "memory" && <AgentMemoryTab agentId={id} />}
      </div>
    </div>
  );
}

function AgentToolsTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data: agentTools } = useQuery({
    queryKey: ["agents", agentId, "tools"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/tools`),
  });

  const { data: allTools } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<any>("/api/tools"),
  });

  const attachTool = useMutation({
    mutationFn: (toolId: string) => api.post(`/api/agents/${agentId}/tools`, { toolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "tools"] });
      toast.success("Tool attached");
    },
  });

  const detachTool = useMutation({
    mutationFn: (toolId: string) => api.delete(`/api/agents/${agentId}/tools/${toolId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "tools"] });
      toast.success("Tool removed");
    },
  });

  const attached = (agentTools as any)?.data ?? [];
  const available = ((allTools as any)?.data ?? []).filter(
    (t: any) => !attached.some((at: any) => at.toolId === t.id),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Attached Tools ({attached.length})</h3>
        {attached.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4">No tools attached yet.</p>
        ) : (
          <div className="space-y-2">
            {attached.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="text-sm text-text font-medium">{t.name ?? t.toolId}</span>
                </div>
                <button
                  onClick={() => detachTool.mutate(t.toolId ?? t.id)}
                  className="text-xs text-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">Available Tools</h3>
          <div className="space-y-2">
            {available.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm text-text font-medium">{t.name}</span>
                  {t.description && <p className="text-xs text-text-tertiary">{t.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => attachTool.mutate(t.id)}>
                  Attach
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentKnowledgeTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const { data: collections } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const { data: agentKnowledge } = useQuery({
    queryKey: ["agents", agentId, "knowledge"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/knowledge`),
  });

  const attachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.post(`/api/agents/${agentId}/knowledge`, { collectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "knowledge"] });
      toast.success("Knowledge collection connected");
    },
  });

  const detachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.delete(`/api/agents/${agentId}/knowledge/${collectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "knowledge"] });
      toast.success("Knowledge collection disconnected");
    },
  });

  const attached = (agentKnowledge as any)?.data ?? [];
  const allCollections = (collections as any)?.data ?? [];
  const available = allCollections.filter(
    (c: any) => !attached.some((ac: any) => ac.collectionId === c.id),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">Connected Collections ({attached.length})</h3>
        {attached.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4">No knowledge collections connected.</p>
        ) : (
          <div className="space-y-2">
            {attached.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-text font-medium">{c.name ?? c.collectionId}</span>
                </div>
                <button
                  onClick={() => detachKnowledge.mutate(c.collectionId ?? c.id)}
                  className="text-xs text-danger hover:underline"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">Available Collections</h3>
          <div className="space-y-2">
            {available.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm text-text font-medium">{c.name}</span>
                  {c.description && <p className="text-xs text-text-tertiary">{c.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => attachKnowledge.mutate(c.id)}>
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentMemoryTab({ agentId }: { agentId: string }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: memoryData } = useQuery({
    queryKey: ["agents", agentId, "memory"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/memory`),
  });

  const deleteMemory = useMutation({
    mutationFn: (memoryId: string) => api.delete(`/api/agents/${agentId}/memory/${memoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "memory"] });
      toast.success("Memory entry deleted");
    },
  });

  const updateMemory = useMutation({
    mutationFn: ({ memoryId, content }: { memoryId: string; content: string }) =>
      api.patch(`/api/agents/${agentId}/memory/${memoryId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "memory"] });
      setEditingId(null);
      toast.success("Memory entry updated");
    },
  });

  const exportMemory = () => {
    window.open(`${import.meta.env.VITE_API_URL ?? ""}/api/agents/${agentId}/memory/export`, "_blank");
  };

  const entries = (memoryData as any)?.data ?? [];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Memory Entries ({entries.length})</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportMemory}>
            Export JSON
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text mb-1">No memories yet</h3>
          <p className="text-sm text-text-secondary">This agent hasn't stored any memories.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: any) => (
            <div key={entry.id} className="p-3 rounded-lg bg-surface-secondary border border-border">
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-2 py-1 text-sm bg-surface border border-border rounded text-text resize-y"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => updateMemory.mutate({ memoryId: entry.id, content: editContent })}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text whitespace-pre-wrap">{entry.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-text-tertiary">
                      {entry.scope && `${entry.scope} | `}
                      {entry.createdAt && new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingId(entry.id); setEditContent(entry.content); }}
                        className="text-xs text-text-tertiary hover:text-text"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteMemory.mutate(entry.id)}
                        className="text-xs text-text-tertiary hover:text-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
