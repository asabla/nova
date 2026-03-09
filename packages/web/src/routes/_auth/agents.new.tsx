import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ArrowLeft, Save, TestTube, Copy, Settings2, Wrench, BookOpen, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";

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
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!agent.name.trim()) {
      toast.error(t("agents.nameRequired", { defaultValue: "Agent name is required" }));
      return;
    }

    setSaving(true);
    try {
      const result = await api.post("/api/agents", agent);
      toast.success(t("agents.created", { defaultValue: "Agent created successfully" }));
      navigate({ to: "/agents" });
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
    { id: "tools" as const, label: t("agents.tabs.tools", { defaultValue: "Tools" }), icon: Wrench },
    { id: "knowledge" as const, label: t("agents.tabs.knowledge", { defaultValue: "Knowledge" }), icon: BookOpen },
    { id: "memory" as const, label: t("agents.tabs.memory", { defaultValue: "Memory" }), icon: Brain },
    { id: "test" as const, label: t("agents.tabs.test", { defaultValue: "Test" }), icon: TestTube },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
              value={agent.name}
              onChange={(e) => setAgent({ ...agent, name: e.target.value })}
              placeholder={t("agents.namePlaceholder", { defaultValue: "Agent name..." })}
              className="text-lg font-semibold text-text bg-transparent border-none outline-none placeholder:text-text-tertiary"
              aria-label={t("agents.nameLabel", { defaultValue: "Agent name" })}
            />
            <Input
              type="text"
              value={agent.description}
              onChange={(e) => setAgent({ ...agent, description: e.target.value })}
              placeholder={t("agents.descriptionPlaceholder", { defaultValue: "Description..." })}
              className="text-sm text-text-secondary bg-transparent border-none outline-none block placeholder:text-text-tertiary"
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
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <Input
                label={t("agents.maxSteps", { defaultValue: "Max Steps" })}
                type="number"
                value={agent.maxSteps}
                onChange={(e) => setAgent({ ...agent, maxSteps: parseInt(e.target.value) || 10 })}
                min={1}
                max={100}
              />
            </div>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-text mb-1">{t("agents.attachTools", { defaultValue: "Attach Tools" })}</h3>
              <p className="text-sm text-text-secondary mb-4">
                {t("agents.attachToolsDesc", { defaultValue: "Enable tools from the marketplace or connect custom tools via OpenAPI specs." })}
              </p>
              <Button variant="primary" onClick={() => navigate({ to: "/tools" })}>{t("agents.browseTools", { defaultValue: "Browse Tools" })}</Button>
            </div>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-text mb-1">{t("agents.connectKnowledge", { defaultValue: "Connect Knowledge" })}</h3>
              <p className="text-sm text-text-secondary mb-4">
                {t("agents.connectKnowledgeDesc", { defaultValue: "Attach knowledge collections so this agent can search and reference your documents." })}
              </p>
              <Button variant="primary" onClick={() => navigate({ to: "/knowledge" })}>{t("agents.browseCollections", { defaultValue: "Browse Collections" })}</Button>
            </div>
          </div>
        )}

        {activeTab === "memory" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-text mb-1">{t("agents.agentMemory", { defaultValue: "Agent Memory" })}</h3>
              <p className="text-sm text-text-secondary mb-4">
                {t("agents.agentMemoryDesc", { defaultValue: "Memory entries will appear here once the agent starts storing information." })}
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
