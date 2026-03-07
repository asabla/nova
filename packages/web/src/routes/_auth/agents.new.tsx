import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ArrowLeft, Save, TestTube, Copy, Settings2, Wrench, BookOpen, Brain } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/agents/new")({
  component: AgentBuilderPage,
});

function AgentBuilderPage() {
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
      toast.error("Agent name is required");
      return;
    }

    setSaving(true);
    try {
      const result = await api.post("/api/agents", agent);
      toast.success("Agent created successfully");
      navigate({ to: "/agents" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestResult("");
    try {
      // Simulate agent test by sending to chat completions
      const result = await api.post<any>("/api/v1/chat/completions", {
        model: agent.modelId || "gpt-4o",
        messages: [
          ...(agent.systemPrompt ? [{ role: "system", content: agent.systemPrompt }] : []),
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

  const tabs = [
    { id: "config" as const, label: "Configuration", icon: Settings2 },
    { id: "tools" as const, label: "Tools", icon: Wrench },
    { id: "knowledge" as const, label: "Knowledge", icon: BookOpen },
    { id: "memory" as const, label: "Memory", icon: Brain },
    { id: "test" as const, label: "Test", icon: TestTube },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
              value={agent.name}
              onChange={(e) => setAgent({ ...agent, name: e.target.value })}
              placeholder="Agent name..."
              className="text-lg font-semibold text-text bg-transparent border-none outline-none placeholder:text-text-tertiary"
            />
            <input
              type="text"
              value={agent.description}
              onChange={(e) => setAgent({ ...agent, description: e.target.value })}
              placeholder="Description..."
              className="text-sm text-text-secondary bg-transparent border-none outline-none block placeholder:text-text-tertiary"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate({ to: "/agents" })}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Create Agent"}
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
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "config" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">System Prompt</label>
              <textarea
                value={agent.systemPrompt}
                onChange={(e) => setAgent({ ...agent, systemPrompt: e.target.value })}
                placeholder="You are a helpful assistant that..."
                rows={8}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm font-mono"
              />
              <p className="text-xs text-text-tertiary mt-1">
                Instructions that define the agent's behavior, personality, and capabilities.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Visibility</label>
                <select
                  value={agent.visibility}
                  onChange={(e) => setAgent({ ...agent, visibility: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                >
                  <option value="private">Private (only you)</option>
                  <option value="team">Team</option>
                  <option value="org">Organization</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Tool Approval</label>
                <select
                  value={agent.toolApprovalMode}
                  onChange={(e) => setAgent({ ...agent, toolApprovalMode: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                >
                  <option value="auto">Auto-approve</option>
                  <option value="always-ask">Always ask</option>
                  <option value="never">Never allow</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Memory Scope</label>
                <select
                  value={agent.memoryScope}
                  onChange={(e) => setAgent({ ...agent, memoryScope: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                >
                  <option value="per-user">Per user</option>
                  <option value="per-conversation">Per conversation</option>
                  <option value="global">Global</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Max Steps</label>
                <input
                  type="number"
                  value={agent.maxSteps}
                  onChange={(e) => setAgent({ ...agent, maxSteps: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
              <h3 className="text-lg font-medium text-text mb-1">Attach Tools</h3>
              <p className="text-sm text-text-secondary mb-4">
                Enable tools from the marketplace or connect custom tools via OpenAPI specs.
              </p>
              <Button variant="primary">Browse Tools</Button>
            </div>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
              <h3 className="text-lg font-medium text-text mb-1">Connect Knowledge</h3>
              <p className="text-sm text-text-secondary mb-4">
                Attach knowledge collections so this agent can search and reference your documents.
              </p>
              <Button variant="primary">Browse Collections</Button>
            </div>
          </div>
        )}

        {activeTab === "memory" && (
          <div className="max-w-2xl">
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
              <h3 className="text-lg font-medium text-text mb-1">Agent Memory</h3>
              <p className="text-sm text-text-secondary mb-4">
                Memory entries will appear here once the agent starts storing information.
              </p>
              <p className="text-xs text-text-tertiary">
                Memory scope: <span className="font-medium">{agent.memoryScope}</span>
              </p>
            </div>
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
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Response</label>
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
