import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ArrowLeft, Save, TestTube, Settings2, Wrench, BookOpen, Brain, Plus, X, Send, Loader2, User, Sparkles, RotateCcw, Globe, Code2, Link2, FileText, Search, Users } from "lucide-react";
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
  const [testMessages, setTestMessages] = useState<{ role: "user" | "assistant" | "error"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testing, setTesting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });

  const models = (modelsData as any)?.data ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [testMessages]);

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
          selectedCollectionIds.map((collectionId) => api.post(`/api/agents/${newId}/knowledge`, { knowledgeCollectionId: collectionId })),
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
    if (!testInput.trim() || testing) return;
    const userMsg = testInput.trim();
    setTestInput("");

    const updatedMessages = [...testMessages, { role: "user" as const, content: userMsg }];
    setTestMessages(updatedMessages);
    setTesting(true);

    try {
      const apiMessages = [
        ...(agent.systemPrompt ? [{ role: "system", content: agent.systemPrompt }] : []),
        ...updatedMessages.filter((m) => m.role !== "error").map((m) => ({ role: m.role, content: m.content })),
      ];
      const defaultModel = models[0]?.modelIdExternal ?? models[0]?.id ?? "gpt-4o";
      const result = await api.post<any>("/v1/chat/completions", {
        model: agent.modelId || defaultModel,
        messages: apiMessages,
      });
      const content = result.choices?.[0]?.message?.content ?? t("agents.noResponse", { defaultValue: "No response" });
      setTestMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (err: any) {
      setTestMessages((prev) => [...prev, { role: "error", content: err.message ?? t("agents.testFailed", { defaultValue: "Test failed" }) }]);
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
          <div className="flex flex-col h-full max-w-3xl mx-auto -mt-6 -mb-6 py-0" style={{ height: "calc(100vh - 180px)" }}>
            {/* Chat messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {testMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <TestTube className="h-7 w-7 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold text-text mb-1">{t("agents.testPlayground", { defaultValue: "Test Playground" })}</h3>
                  <p className="text-sm text-text-tertiary max-w-sm mb-6">
                    {t("agents.testPlaygroundDesc", { defaultValue: "Send messages to test your agent's behavior. The conversation uses the current system prompt and model." })}
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    {[
                      t("agents.testSample1", { defaultValue: "Introduce yourself" }),
                      t("agents.testSample2", { defaultValue: "What can you help me with?" }),
                      t("agents.testSample3", { defaultValue: "Give me an example of your work" }),
                      t("agents.testSample4", { defaultValue: "What are your limitations?" }),
                    ].map((sample) => (
                      <button
                        key={sample}
                        onClick={() => setTestInput(sample)}
                        className="text-left text-xs p-3 rounded-xl bg-surface-secondary border border-border text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {testMessages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role !== "user" && (
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === "error" ? "bg-danger/15" : "bg-primary/10"
                      }`}
                    >
                      {msg.role === "error" ? (
                        <Sparkles className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : msg.role === "error"
                          ? "bg-danger/10 text-danger border border-danger/20 rounded-bl-md"
                          : "bg-surface-secondary border border-border text-text rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                    </div>
                  )}
                </div>
              ))}

              {testing && (
                <div className="flex gap-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  </div>
                  <div className="bg-surface-secondary border border-border rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {testMessages.length > 0 && (
                  <button
                    onClick={() => setTestMessages([])}
                    className="p-2 rounded-lg hover:bg-surface-secondary text-text-tertiary hover:text-text transition-colors shrink-0"
                    title={t("agents.clearChat", { defaultValue: "Clear chat" })}
                    aria-label={t("agents.clearChat", { defaultValue: "Clear chat" })}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTest(); } }}
                    placeholder={t("agents.testInputPlaceholder", { defaultValue: "Type a message to test..." })}
                    disabled={testing}
                    className="w-full h-10 pl-4 pr-12 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:border-primary/50 transition-colors"
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing || !testInput.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-tertiary transition-colors disabled:opacity-30 hover:bg-primary/10 hover:text-primary"
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-text-tertiary mt-1.5 text-center">
                {t("agents.testDisclaimer", { defaultValue: "Test responses use the current system prompt and selected model. Changes are not saved automatically." })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools selector for the create page
// ---------------------------------------------------------------------------

const BUILTIN_TOOLS_INFO = [
  { name: "web_search", label: "Web Search", description: "Search the web for current information via SearxNG", icon: Globe, color: "#3b82f6" },
  { name: "fetch_url", label: "Fetch URL", description: "Retrieve and extract content from any web page", icon: Link2, color: "#06b6d4" },
  { name: "code_execute", label: "Code Execution", description: "Run Python, JavaScript, and other code in a sandboxed environment", icon: Code2, color: "#22c55e" },
  { name: "read_file", label: "Read File", description: "Read files from the workspace storage", icon: FileText, color: "#f97316" },
  { name: "search_workspace", label: "Search Workspace", description: "Search across conversations and knowledge in the organization", icon: Search, color: "#a855f7" },
  { name: "invoke_agent", label: "Invoke Agent", description: "Delegate tasks to other specialized agents", icon: Users, color: "#ec4899" },
];

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
      <div className="max-w-3xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Built-in tools */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text">
            {t("agents.builtinTools", { defaultValue: "Built-in Tools" })}
            <span className="ml-1.5 text-text-tertiary font-normal">({BUILTIN_TOOLS_INFO.length})</span>
          </h3>
          <span className="text-[10px] text-text-tertiary px-2 py-0.5 rounded-full bg-surface-secondary border border-border">
            {t("agents.alwaysAvailable", { defaultValue: "Always available" })}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUILTIN_TOOLS_INFO.map((bt) => {
            const Icon = bt.icon;
            return (
              <div key={bt.name} className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${bt.color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: bt.color }} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{bt.label}</p>
                  <p className="text-[10px] text-text-tertiary truncate">{bt.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom tools — selected */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">
          {t("agents.customTools", { defaultValue: "Custom Tools" })}
          <span className="ml-1.5 text-text-tertiary font-normal">({selected.length})</span>
        </h3>
        {selected.length === 0 ? (
          <div className="flex flex-col items-center py-8 rounded-xl border border-dashed border-border">
            <Wrench className="h-8 w-8 text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-sm text-text-secondary mb-1">{t("agents.noCustomTools", { defaultValue: "No custom tools selected" })}</p>
            <p className="text-xs text-text-tertiary">{t("agents.customToolsHint", { defaultValue: "Attach custom tools from your organization's tool library below." })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selected.map((tool) => (
              <div key={tool.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border group">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{tool.name}</p>
                  {tool.description && <p className="text-[10px] text-text-tertiary truncate mt-0.5">{tool.description}</p>}
                </div>
                <button
                  onClick={() => onToggle(tool.id)}
                  className="px-2 py-1 rounded-lg text-xs text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {t("common.remove", { defaultValue: "Remove" })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom tools — available */}
      {available.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            {t("agents.availableTools", { defaultValue: "Available" })}
            <span className="ml-1.5 text-text-tertiary font-normal">({available.length})</span>
          </h3>
          <div className="space-y-2">
            {available.map((tool) => (
              <div key={tool.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-border-strong transition-colors group">
                <div className="h-9 w-9 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0">
                  <Wrench className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{tool.name}</p>
                  {tool.description && <p className="text-[10px] text-text-tertiary truncate mt-0.5">{tool.description}</p>}
                </div>
                <Button variant="secondary" size="sm" onClick={() => onToggle(tool.id)}>
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

  const statusColor = (status: string) => {
    if (status === "ready" || status === "indexed") return "text-success";
    if (status === "indexing" || status === "pending") return "text-warning";
    return "text-text-tertiary";
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Selected */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">
          {t("agents.selectedCollections", { defaultValue: "Selected" })}
          <span className="ml-1.5 text-text-tertiary font-normal">({selected.length})</span>
        </h3>
        {selected.length === 0 ? (
          <div className="flex flex-col items-center py-8 rounded-xl border border-dashed border-border">
            <BookOpen className="h-8 w-8 text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-sm text-text-secondary">{t("agents.noKnowledgeSelected", { defaultValue: "No collections selected" })}</p>
            <p className="text-xs text-text-tertiary">{t("agents.knowledgeHint", { defaultValue: "Connect collections below to give this agent access to your documents." })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selected.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border group">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.status && <span className={`text-[10px] font-medium ${statusColor(c.status)}`}>{c.status}</span>}
                    {c.description && <span className="text-[10px] text-text-tertiary truncate">{c.description}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onToggle(c.id)}
                  className="px-2 py-1 rounded-lg text-xs text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  {t("common.remove", { defaultValue: "Remove" })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">
          {t("agents.availableCollections", { defaultValue: "Available" })}
          <span className="ml-1.5 text-text-tertiary font-normal">({available.length})</span>
        </h3>
        {available.length === 0 && allCollections.length === 0 ? (
          <div className="flex flex-col items-center py-8 rounded-xl border border-dashed border-border">
            <p className="text-sm text-text-tertiary">{t("agents.noCollections", { defaultValue: "No knowledge collections exist yet." })}</p>
          </div>
        ) : available.length === 0 ? (
          <p className="text-xs text-text-tertiary py-2">{t("agents.allSelected", { defaultValue: "All collections are already selected." })}</p>
        ) : (
          <div className="space-y-2">
            {available.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-border-strong transition-colors group">
                <div className="h-9 w-9 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.status && <span className={`text-[10px] font-medium ${statusColor(c.status)}`}>{c.status}</span>}
                    {c.description && <span className="text-[10px] text-text-tertiary truncate">{c.description}</span>}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onToggle(c.id)}>
                  {t("agents.connect", { defaultValue: "Connect" })}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
