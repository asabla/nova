import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ArrowLeft, Save, TestTube, Settings2, Wrench, BookOpen, Brain, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export const Route = createFileRoute("/_auth/agents/new")({
  component: AgentBuilderPage,
});

function AgentBuilderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"config" | "tools" | "knowledge" | "memory" | "test">("config");
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    modelId: "",
    visibility: "private" as "private" | "team" | "org" | "public",
    toolApprovalMode: "always-ask" as "auto" | "always-ask" | "never",
    memoryScope: "per-user" as "per-user" | "per-conversation" | "global",
    maxSteps: 10,
    timeoutSeconds: 300,
  });
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });

  const models = (modelsData as any)?.data ?? [];

  const handleSave = async () => {
    if (!agent.name.trim()) {
      toast.error(t("agents.nameRequired", { defaultValue: "Agent name is required" }));
      return;
    }

    setSaving(true);
    try {
      const result = await api.post<any>("/api/agents", agent);
      const newId = result.id ?? result.data?.id;

      // Attach selected tools
      if (newId && selectedToolIds.length > 0) {
        const toolResults = await Promise.allSettled(
          selectedToolIds.map((toolId) => api.post(`/api/agents/${newId}/tools`, { toolId })),
        );
        const failed = toolResults.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          toast.warning(t("agents.someToolsFailed", { defaultValue: `${failed} tool(s) failed to attach`, count: failed }));
        }
      }

      // Attach selected knowledge collections
      if (newId && selectedCollectionIds.length > 0) {
        const knowledgeResults = await Promise.allSettled(
          selectedCollectionIds.map((collectionId) => api.post(`/api/agents/${newId}/knowledge`, { collectionId })),
        );
        const failed = knowledgeResults.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          toast.warning(t("agents.someKnowledgeFailed", { defaultValue: `${failed} collection(s) failed to attach`, count: failed }));
        }
      }

      toast.success(t("agents.created", { defaultValue: "Agent created successfully" }));
      navigate({ to: newId ? `/agents/${newId}` : "/agents" });
    } catch (err: any) {
      toast.error(err.message ?? t("agents.createFailed", { defaultValue: "Failed to create agent" }));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestResult("");
    try {
      const result = await api.post<any>("/api/v1/chat/completions", {
        model: agent.modelId || "gpt-4o",
        messages: [
          ...(agent.systemPrompt ? [{ role: "system", content: agent.systemPrompt }] : []),
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

  const tabs = [
    { id: "config" as const, label: t("agents.tabs.config", { defaultValue: "Configuration" }), icon: Settings2 },
    { id: "tools" as const, label: t("agents.tabs.tools", { defaultValue: "Tools" }), icon: Wrench, count: selectedToolIds.length },
    { id: "knowledge" as const, label: t("agents.tabs.knowledge", { defaultValue: "Knowledge" }), icon: BookOpen, count: selectedCollectionIds.length },
    { id: "memory" as const, label: t("agents.tabs.memory", { defaultValue: "Memory" }), icon: Brain },
    { id: "test" as const, label: t("agents.tabs.test", { defaultValue: "Test" }), icon: TestTube },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => navigate({ to: "/agents" })} className="p-1.5 hover:bg-surface-secondary rounded-lg shrink-0" aria-label={t("common.goBack", { defaultValue: "Go back" })}>
            <ArrowLeft className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={agent.name}
              onChange={(e) => setAgent({ ...agent, name: e.target.value })}
              placeholder={t("agents.namePlaceholder", { defaultValue: "Agent name..." })}
              className="text-base font-semibold text-text bg-transparent border-none outline-none w-full placeholder:text-text-tertiary"
              aria-label={t("agents.nameLabel", { defaultValue: "Agent name" })}
            />
            <input
              type="text"
              value={agent.description}
              onChange={(e) => setAgent({ ...agent, description: e.target.value })}
              placeholder={t("agents.descriptionPlaceholder", { defaultValue: "Description..." })}
              className="text-xs text-text-secondary bg-transparent border-none outline-none w-full placeholder:text-text-tertiary"
              aria-label={t("agents.descriptionLabel", { defaultValue: "Agent description" })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/agents" })}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? t("common.saving", { defaultValue: "Saving..." }) : t("agents.createAgent", { defaultValue: "Create Agent" })}
          </Button>
        </div>
      </div>

      {/* Tabs */}
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
            {"count" in tab && tab.count != null && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "config" && (
          <div className="max-w-2xl space-y-6">
            <Textarea
              label={t("agents.systemPrompt", { defaultValue: "System Prompt" })}
              value={agent.systemPrompt}
              onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })}
              placeholder={t("agents.systemPromptNewPlaceholder", { defaultValue: "You are a helpful assistant that..." })}
              rows={8}
              helperText={t("agents.systemPromptHint", { defaultValue: "Instructions that define the agent's behavior, personality, and capabilities." })}
              className="font-mono"
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t("agents.model", { defaultValue: "Model" })}
                value={agent.modelId}
                onChange={(value) => setAgent({ ...agent, modelId: value })}
                options={[
                  { value: "", label: t("agents.defaultModel", { defaultValue: "Default" }) },
                  ...models.map((m: any) => ({ value: m.modelIdExternal ?? m.id, label: m.name })),
                ]}
              />
              <Select
                label={t("agents.visibility", { defaultValue: "Visibility" })}
                value={agent.visibility}
                onChange={(value) => setAgent({ ...agent, visibility: value as any })}
                options={[
                  { value: "private", label: t("agents.visibilityPrivateOnly", { defaultValue: "Private (only you)" }) },
                  { value: "team", label: t("agents.visibilityTeam", { defaultValue: "Team" }) },
                  { value: "org", label: t("agents.visibilityOrg", { defaultValue: "Organization" }) },
                  { value: "public", label: t("agents.visibilityPublic", { defaultValue: "Public" }) },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t("agents.toolApproval", { defaultValue: "Tool Approval" })}
                value={agent.toolApprovalMode}
                onChange={(value) => setAgent({ ...agent, toolApprovalMode: value as any })}
                options={[
                  { value: "auto", label: t("agents.toolAuto", { defaultValue: "Auto-approve" }) },
                  { value: "always-ask", label: t("agents.toolAlwaysAsk", { defaultValue: "Always ask" }) },
                  { value: "never", label: t("agents.toolNever", { defaultValue: "Never allow" }) },
                ]}
              />
              <Select
                label={t("agents.memoryScope", { defaultValue: "Memory Scope" })}
                value={agent.memoryScope}
                onChange={(value) => setAgent({ ...agent, memoryScope: value as any })}
                options={[
                  { value: "per-user", label: t("agents.memoryPerUser", { defaultValue: "Per user" }) },
                  { value: "per-conversation", label: t("agents.memoryPerConversation", { defaultValue: "Per conversation" }) },
                  { value: "global", label: t("agents.memoryGlobal", { defaultValue: "Global" }) },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t("agents.maxSteps", { defaultValue: "Max Steps" })}
                type="number"
                value={agent.maxSteps}
                onChange={(e) => setAgent({ ...agent, maxSteps: parseInt(e.target.value) || 10 })}
                min={1}
                max={100}
              />
              <Input
                label={t("agents.timeout", { defaultValue: "Timeout (seconds)" })}
                type="number"
                value={agent.timeoutSeconds}
                onChange={(e) => setAgent({ ...agent, timeoutSeconds: parseInt(e.target.value) || 300 })}
                min={10}
                max={3600}
              />
            </div>
          </div>
        )}

        {activeTab === "tools" && (
          <ToolsSelector
            selectedToolIds={selectedToolIds}
            onToggle={(toolId) =>
              setSelectedToolIds((prev) =>
                prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
              )
            }
          />
        )}

        {activeTab === "knowledge" && (
          <KnowledgeSelector
            selectedCollectionIds={selectedCollectionIds}
            onToggle={(collectionId) =>
              setSelectedCollectionIds((prev) =>
                prev.includes(collectionId) ? prev.filter((id) => id !== collectionId) : [...prev, collectionId],
              )
            }
          />
        )}

        {activeTab === "memory" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-text mb-1">{t("agents.agentMemory", { defaultValue: "Agent Memory" })}</h3>
              <p className="text-sm text-text-secondary mb-4">
                {t("agents.memoryCreateHint", { defaultValue: "Memory entries will be generated as users interact with this agent." })}
              </p>
              <p className="text-xs text-text-tertiary">
                {t("agents.memoryScopeLabel", { defaultValue: "Memory scope" })}: <span className="font-medium">{agent.memoryScope}</span>
              </p>
            </div>
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
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">{t("agents.response", { defaultValue: "Response" })}</label>
                <div className="px-3 py-2 rounded-lg border border-border bg-surface-secondary text-sm text-text whitespace-pre-wrap">
                  {testResult}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools selector for the create page
// ---------------------------------------------------------------------------

function ToolsSelector({
  selectedToolIds,
  onToggle,
}: {
  selectedToolIds: string[];
  onToggle: (toolId: string) => void;
}) {
  const { t } = useTranslation();

  const { data: allToolsData, isLoading } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<any>("/api/tools"),
    staleTime: 60_000,
  });

  const allTools: any[] = (allToolsData as any)?.data ?? [];
  const selected = allTools.filter((tool) => selectedToolIds.includes(tool.id));
  const available = allTools.filter((tool) => !selectedToolIds.includes(tool.id));

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (allTools.length === 0) {
    return (
      <div className="max-w-2xl text-center py-12">
        <Wrench className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-lg font-medium text-text mb-1">{t("agents.noToolsAvailable", { defaultValue: "No tools available" })}</h3>
        <p className="text-sm text-text-secondary">
          {t("agents.noToolsAvailableDesc", { defaultValue: "Create tools first, then come back to attach them." })}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {selected.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            {t("agents.selectedTools", { defaultValue: "Selected Tools" })} ({selected.length})
          </h3>
          <div className="space-y-2">
            {selected.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
                  <div>
                    <span className="text-sm text-text font-medium">{tool.name}</span>
                    {tool.description && <p className="text-xs text-text-tertiary">{tool.description}</p>}
                  </div>
                </div>
                <button onClick={() => onToggle(tool.id)} className="text-xs text-danger hover:underline">
                  {t("common.remove", { defaultValue: "Remove" })}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            {t("agents.availableTools", { defaultValue: "Available Tools" })}
          </h3>
          <div className="space-y-2">
            {available.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm text-text font-medium">{tool.name}</span>
                  {tool.description && <p className="text-xs text-text-tertiary">{tool.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => onToggle(tool.id)}>
                  <Plus className="h-3 w-3 mr-1" aria-hidden="true" />
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

// ---------------------------------------------------------------------------
// Knowledge selector for the create page
// ---------------------------------------------------------------------------

function KnowledgeSelector({
  selectedCollectionIds,
  onToggle,
}: {
  selectedCollectionIds: string[];
  onToggle: (collectionId: string) => void;
}) {
  const { t } = useTranslation();

  const { data: collectionsData, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.get<any>("/api/knowledge"),
    staleTime: 60_000,
  });

  const allCollections: any[] = (collectionsData as any)?.data ?? [];
  const selected = allCollections.filter((c) => selectedCollectionIds.includes(c.id));
  const available = allCollections.filter((c) => !selectedCollectionIds.includes(c.id));

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (allCollections.length === 0) {
    return (
      <div className="max-w-2xl text-center py-12">
        <BookOpen className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-lg font-medium text-text mb-1">{t("agents.noCollectionsAvailable", { defaultValue: "No knowledge collections" })}</h3>
        <p className="text-sm text-text-secondary">
          {t("agents.noCollectionsAvailableDesc", { defaultValue: "Create a knowledge collection first, then attach it here." })}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {selected.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            {t("agents.selectedCollections", { defaultValue: "Selected Collections" })} ({selected.length})
          </h3>
          <div className="space-y-2">
            {selected.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-400" aria-hidden="true" />
                  <div>
                    <span className="text-sm text-text font-medium">{c.name}</span>
                    {c.description && <p className="text-xs text-text-tertiary">{c.description}</p>}
                  </div>
                </div>
                <button onClick={() => onToggle(c.id)} className="text-xs text-danger hover:underline">
                  {t("agents.disconnect", { defaultValue: "Disconnect" })}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            {t("agents.availableCollections", { defaultValue: "Available Collections" })}
          </h3>
          <div className="space-y-2">
            {available.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <span className="text-sm text-text font-medium">{c.name}</span>
                  {c.description && <p className="text-xs text-text-tertiary">{c.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => onToggle(c.id)}>
                  <Plus className="h-3 w-3 mr-1" aria-hidden="true" />
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
