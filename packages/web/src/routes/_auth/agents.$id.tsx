import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ArrowLeft, Save, Trash2, Copy, Share2, History, TestTube, Settings2, Wrench, BookOpen, Brain, RefreshCw, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { Skeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatDateTime } from "../../lib/format";

export const Route = createFileRoute("/_auth/agents/$id")({
  component: AgentDetailPage,
});

function AgentDetailPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"config" | "tools" | "knowledge" | "memory" | "test">("config");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: agent, isLoading, isError, refetch } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => api.get<any>(`/api/agents/${id}`),
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    modelId: "",
    visibility: "private",
    toolApprovalMode: "always-ask",
    memoryScope: "per-user",
  });

  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });

  const models = (modelsData as any)?.data ?? [];

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name ?? "",
        description: agent.description ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        modelId: agent.modelId ?? "",
        visibility: agent.visibility ?? "private",
        toolApprovalMode: agent.toolApprovalMode ?? "always-ask",
        memoryScope: agent.memoryScope ?? "per-user",
      });
    }
  }, [agent]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.patch(`/api/agents/${id}`, data),
    onSuccess: () => {
      toast.success(t("agents.updated", { defaultValue: "Agent updated" }));
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.updateFailed", { defaultValue: "Update failed" })),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/agents/${id}`),
    onSuccess: () => {
      toast.success(t("agents.deleted", { defaultValue: "Agent deleted" }));
      navigate({ to: "/agents" });
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.deleteFailed", { defaultValue: "Delete failed" })),
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
      toast.success(t("agents.cloned", { defaultValue: "Agent cloned" }));
      navigate({ to: "/agents/$id", params: { id: data.id } });
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.cloneFailed", { defaultValue: "Clone failed" })),
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
      setTestResult(result.choices?.[0]?.message?.content ?? t("agents.noResponse", { defaultValue: "No response" }));
    } catch (err: any) {
      setTestResult(`${t("common.error", { defaultValue: "Error" })}: ${err.message ?? t("agents.testFailed", { defaultValue: "Test failed" })}`);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full max-w-2xl rounded-lg" />
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-sm text-danger mb-4">{t("agents.loadError", { defaultValue: "Failed to load agent." })}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "config" as const, label: t("agents.tabs.config", { defaultValue: "Configuration" }), icon: Settings2 },
    { id: "tools" as const, label: t("agents.tabs.tools", { defaultValue: "Tools" }), icon: Wrench },
    { id: "knowledge" as const, label: t("agents.tabs.knowledge", { defaultValue: "Knowledge" }), icon: BookOpen },
    { id: "memory" as const, label: t("agents.tabs.memory", { defaultValue: "Memory" }), icon: Brain },
    { id: "test" as const, label: t("agents.tabs.test", { defaultValue: "Test" }), icon: TestTube },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/agents" })} className="p-1 hover:bg-surface-secondary rounded" aria-label={t("common.goBack", { defaultValue: "Go back" })}>
            <ArrowLeft className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <Input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="text-lg font-semibold text-text bg-transparent border-none outline-none"
              aria-label={t("agents.nameLabel", { defaultValue: "Agent name" })}
            />
            <Input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("agents.descriptionPlaceholder", { defaultValue: "Description..." })}
              className="text-sm text-text-secondary bg-transparent border-none outline-none block placeholder:text-text-tertiary"
              aria-label={t("agents.descriptionLabel", { defaultValue: "Agent description" })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/conversations/new", search: { agentId: id } })}>
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {t("agents.chat", { defaultValue: "Chat" })}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => cloneMutation.mutate()}>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {t("agents.clone", { defaultValue: "Clone" })}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.delete", { defaultValue: "Delete" })}
          </Button>
          <Button
            variant="primary"
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {updateMutation.isPending ? t("common.saving", { defaultValue: "Saving..." }) : t("common.save", { defaultValue: "Save" })}
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
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === "config" && (
          <div className="max-w-2xl space-y-6">
            <Textarea
              label={t("agents.systemPrompt", { defaultValue: "System Prompt" })}
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              placeholder={t("agents.systemPromptPlaceholder", { defaultValue: "You are a helpful assistant..." })}
              rows={8}
              className="font-mono"
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t("agents.model", { defaultValue: "Model" })}
                value={form.modelId}
                onChange={(value) => setForm({ ...form, modelId: value })}
                options={[
                  { value: "", label: t("agents.defaultModel", { defaultValue: "Default" }) },
                  ...models.map((m: any) => ({ value: m.modelIdExternal ?? m.id, label: m.name })),
                ]}
              />
              <Select
                label={t("agents.visibility", { defaultValue: "Visibility" })}
                value={form.visibility}
                onChange={(value) => setForm({ ...form, visibility: value })}
                options={[
                  { value: "private", label: t("agents.visibilityPrivate", { defaultValue: "Private" }) },
                  { value: "team", label: t("agents.visibilityTeam", { defaultValue: "Team" }) },
                  { value: "org", label: t("agents.visibilityOrg", { defaultValue: "Organization" }) },
                  { value: "public", label: t("agents.visibilityPublic", { defaultValue: "Public" }) },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t("agents.toolApproval", { defaultValue: "Tool Approval" })}
                value={form.toolApprovalMode}
                onChange={(value) => setForm({ ...form, toolApprovalMode: value })}
                options={[
                  { value: "auto", label: t("agents.toolAuto", { defaultValue: "Auto-approve" }) },
                  { value: "always-ask", label: t("agents.toolAlwaysAsk", { defaultValue: "Always ask" }) },
                  { value: "never", label: t("agents.toolNever", { defaultValue: "Never allow" }) },
                ]}
              />
              <Select
                label={t("agents.memoryScope", { defaultValue: "Memory Scope" })}
                value={form.memoryScope}
                onChange={(value) => setForm({ ...form, memoryScope: value })}
                options={[
                  { value: "per-user", label: t("agents.memoryPerUser", { defaultValue: "Per user" }) },
                  { value: "per-conversation", label: t("agents.memoryPerConversation", { defaultValue: "Per conversation" }) },
                  { value: "global", label: t("agents.memoryGlobal", { defaultValue: "Global" }) },
                ]}
              />
            </div>

            {agent && (
              <div className="pt-4 border-t border-border text-xs text-text-tertiary space-y-1">
                <p>{t("agents.version", { defaultValue: "Version" })}: {agent.currentVersion}</p>
                <p>{t("common.created", { defaultValue: "Created" })}: {formatDateTime(agent.createdAt)}</p>
                <p>{t("common.updated", { defaultValue: "Updated" })}: {formatDateTime(agent.updatedAt)}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "test" && (
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">{t("agents.testPrompt", { defaultValue: "Test Prompt" })}</label>
              <div className="flex gap-2">
                <Textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder={t("agents.testPlaceholder", { defaultValue: "Enter a test message..." })}
                  rows={3}
                  className="flex-1"
                />
                <Button variant="primary" onClick={handleTest} disabled={testing || !testPrompt.trim()}>
                  <TestTube className="h-4 w-4" aria-hidden="true" />
                  {testing ? t("agents.running", { defaultValue: "Running..." }) : t("agents.test", { defaultValue: "Test" })}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} title={t("agents.deleteTitle", { defaultValue: "Delete Agent" })}>
        <p className="text-sm text-text-secondary mb-4">
          {t("agents.deleteConfirm", { defaultValue: "Are you sure you want to delete this agent? This action cannot be undone." })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteMutation.mutate();
              setShowDeleteDialog(false);
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {deleteMutation.isPending ? t("common.deleting", { defaultValue: "Deleting..." }) : t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function AgentToolsTab({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: agentTools, isLoading: toolsLoading, isError: toolsError, refetch: refetchTools } = useQuery({
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
      toast.success(t("agents.toolAttached", { defaultValue: "Tool attached" }));
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.toolAttachFailed", { defaultValue: "Failed to attach tool" })),
  });

  const detachTool = useMutation({
    mutationFn: (toolId: string) => api.delete(`/api/agents/${agentId}/tools/${toolId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "tools"] });
      toast.success(t("agents.toolRemoved", { defaultValue: "Tool removed" }));
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.toolRemoveFailed", { defaultValue: "Failed to remove tool" })),
  });

  const attached = (agentTools as any)?.data ?? [];
  const available = ((allTools as any)?.data ?? []).filter(
    (tool: any) => !attached.some((at: any) => at.toolId === tool.id),
  );

  if (toolsLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (toolsError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-danger mb-4">{t("agents.toolsLoadError", { defaultValue: "Failed to load tools." })}</p>
        <Button variant="secondary" onClick={() => refetchTools()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">{t("agents.attachedTools", { defaultValue: "Attached Tools" })} ({attached.length})</h3>
        {attached.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4">{t("agents.noToolsAttached", { defaultValue: "No tools attached yet." })}</p>
        ) : (
          <div className="space-y-2">
            {attached.map((tool: any) => (
              <div key={tool.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-sm text-text font-medium">{tool.name ?? tool.toolId}</span>
                </div>
                <button
                  onClick={() => detachTool.mutate(tool.toolId ?? tool.id)}
                  className="text-xs text-danger hover:underline cursor-pointer"
                >
                  {t("common.remove", { defaultValue: "Remove" })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">{t("agents.availableTools", { defaultValue: "Available Tools" })}</h3>
          <div className="space-y-2">
            {available.map((tool: any) => (
              <div key={tool.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm text-text font-medium">{tool.name}</span>
                  {tool.description && <p className="text-xs text-text-tertiary">{tool.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => attachTool.mutate(tool.id)}>
                  {t("agents.attach", { defaultValue: "Attach" })}
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: collections } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const { data: agentKnowledge, isLoading: knowledgeLoading, isError: knowledgeError, refetch: refetchKnowledge } = useQuery({
    queryKey: ["agents", agentId, "knowledge"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/knowledge`),
  });

  const attachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.post(`/api/agents/${agentId}/knowledge`, { collectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "knowledge"] });
      toast.success(t("agents.knowledgeConnected", { defaultValue: "Knowledge collection connected" }));
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.knowledgeConnectFailed", { defaultValue: "Failed to connect knowledge" })),
  });

  const detachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.delete(`/api/agents/${agentId}/knowledge/${collectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "knowledge"] });
      toast.success(t("agents.knowledgeDisconnected", { defaultValue: "Knowledge collection disconnected" }));
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.knowledgeDisconnectFailed", { defaultValue: "Failed to disconnect knowledge" })),
  });

  const attached = (agentKnowledge as any)?.data ?? [];
  const allCollections = (collections as any)?.data ?? [];
  const available = allCollections.filter(
    (c: any) => !attached.some((ac: any) => ac.collectionId === c.id),
  );

  if (knowledgeLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (knowledgeError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-danger mb-4">{t("agents.knowledgeLoadError", { defaultValue: "Failed to load knowledge." })}</p>
        <Button variant="secondary" onClick={() => refetchKnowledge()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">{t("agents.connectedCollections", { defaultValue: "Connected Collections" })} ({attached.length})</h3>
        {attached.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4">{t("agents.noKnowledge", { defaultValue: "No knowledge collections connected." })}</p>
        ) : (
          <div className="space-y-2">
            {attached.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-400" aria-hidden="true" />
                  <span className="text-sm text-text font-medium">{c.name ?? c.collectionId}</span>
                </div>
                <button
                  onClick={() => detachKnowledge.mutate(c.collectionId ?? c.id)}
                  className="text-xs text-danger hover:underline cursor-pointer"
                >
                  {t("agents.disconnect", { defaultValue: "Disconnect" })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">{t("agents.availableCollections", { defaultValue: "Available Collections" })}</h3>
          <div className="space-y-2">
            {available.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm text-text font-medium">{c.name}</span>
                  {c.description && <p className="text-xs text-text-tertiary">{c.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => attachKnowledge.mutate(c.id)}>
                  {t("agents.connect", { defaultValue: "Connect" })}
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: memoryData, isLoading: memoryLoading, isError: memoryError, refetch: refetchMemory } = useQuery({
    queryKey: ["agents", agentId, "memory"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/memory`),
  });

  const deleteMemory = useMutation({
    mutationFn: (memoryId: string) => api.delete(`/api/agents/${agentId}/memory/${memoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "memory"] });
      toast.success(t("agents.memoryDeleted", { defaultValue: "Memory entry deleted" }));
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.memoryDeleteFailed", { defaultValue: "Failed to delete memory entry" })),
  });

  const updateMemory = useMutation({
    mutationFn: ({ memoryId, content }: { memoryId: string; content: string }) =>
      api.patch(`/api/agents/${agentId}/memory/${memoryId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "memory"] });
      setEditingId(null);
      toast.success(t("agents.memoryUpdated", { defaultValue: "Memory entry updated" }));
    },
    onError: (err: any) => toast.error(err.message ?? t("agents.memoryUpdateFailed", { defaultValue: "Failed to update memory entry" })),
  });

  const exportMemory = () => {
    window.open(`${import.meta.env.VITE_API_URL ?? ""}/api/agents/${agentId}/memory/export`, "_blank");
  };

  const entries = (memoryData as any)?.data ?? [];

  if (memoryLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (memoryError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-danger mb-4">{t("agents.memoryLoadError", { defaultValue: "Failed to load memory." })}</p>
        <Button variant="secondary" onClick={() => refetchMemory()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{t("agents.memoryEntries", { defaultValue: "Memory Entries" })} ({entries.length})</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportMemory}>
            {t("agents.exportJson", { defaultValue: "Export JSON" })}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-lg font-medium text-text mb-1">{t("agents.noMemories", { defaultValue: "No memories yet" })}</h3>
          <p className="text-sm text-text-secondary">{t("agents.noMemoriesDesc", { defaultValue: "This agent hasn't stored any memories." })}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry: any) => (
            <div key={entry.id} className="p-3 rounded-lg bg-surface-secondary border border-border">
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => updateMemory.mutate({ memoryId: entry.id, content: editContent })}>
                      {t("common.save", { defaultValue: "Save" })}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text whitespace-pre-wrap">{entry.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-text-tertiary">
                      {entry.scope && `${entry.scope} | `}
                      {entry.createdAt && formatDateTime(entry.createdAt)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingId(entry.id); setEditContent(entry.content); }}
                        className="text-xs text-text-tertiary hover:text-text"
                      >
                        {t("common.edit", { defaultValue: "Edit" })}
                      </button>
                      <button
                        onClick={() => deleteMemory.mutate(entry.id)}
                        className="text-xs text-text-tertiary hover:text-danger"
                      >
                        {t("common.delete", { defaultValue: "Delete" })}
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
