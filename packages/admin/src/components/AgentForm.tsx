import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Save, Trash2, Bot, Plus, X, Eye, EyeOff,
  Sparkles, Settings2, MessageSquare, Palette, Loader2,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { SplitPaneLayout } from "./SplitPaneLayout";
import { AgentPreviewPanel } from "./AgentPreviewPanel";

// ─── Constants ───────────────────────────────────────────────────────

const AGENT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#a855f7",
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "team", label: "Team" },
  { value: "org", label: "Organisation" },
  { value: "public", label: "Public" },
];

const TOOL_APPROVAL_OPTIONS = [
  { value: "auto", label: "Auto-approve" },
  { value: "always-ask", label: "Always ask" },
  { value: "never", label: "Never allow" },
];

const TIER_OPTIONS = [
  { value: "", label: "Auto" },
  { value: "direct", label: "Direct" },
  { value: "sequential", label: "Sequential" },
  { value: "orchestrated", label: "Orchestrated" },
];

const EFFORT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// ─── Types ───────────────────────────────────────────────────────────

export interface AgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  visibility: string;
  isPublished: boolean;
  avatarUrl: string;
  toolApprovalMode: string;
  starters: string[];
  defaultTier: string;
  effortLevel: string;
}

const DEFAULT_FORM: AgentFormData = {
  name: "",
  description: "",
  systemPrompt: "",
  modelId: "",
  visibility: "org",
  isPublished: false,
  avatarUrl: "",
  toolApprovalMode: "always-ask",
  starters: [],
  defaultTier: "",
  effortLevel: "medium",
};

// ─── Styles ──────────────────────────────────────────────────────────

const card = { background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" };
const inputStyle = { background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" };
const labelClass = "block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5";

// ─── Component ───────────────────────────────────────────────────────

export function AgentForm({ mode, agentId }: { mode: "create" | "edit"; agentId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<AgentFormData>(DEFAULT_FORM);
  const savedRef = useRef<AgentFormData>(DEFAULT_FORM);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const setField = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Queries ─────────────────────────────────────────────────────

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["admin-marketplace-agent", agentId],
    queryFn: () => adminApi.get<any>(`/admin-api/marketplace/agents/${agentId}`),
    enabled: mode === "edit" && !!agentId,
  });

  const { data: modelsData } = useQuery({
    queryKey: ["admin-marketplace-models"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/marketplace/models"),
  });

  const modelsList = modelsData?.data ?? [];
  const hasModels = modelsList.length > 0;

  useEffect(() => {
    if (agent) {
      const params = (agent.modelParams as Record<string, any>) ?? {};
      const loaded: AgentFormData = {
        name: agent.name ?? "",
        description: agent.description ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        modelId: agent.modelId ?? "",
        visibility: agent.visibility ?? "org",
        isPublished: agent.isPublished ?? false,
        avatarUrl: agent.avatarUrl ?? "",
        toolApprovalMode: agent.toolApprovalMode ?? "always-ask",
        starters: (agent.starters as string[]) ?? [],
        defaultTier: params.defaultTier ?? "",
        effortLevel: params.effortLevel ?? "medium",
      };
      setForm(loaded);
      savedRef.current = loaded;
    }
  }, [agent]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);

  // ─── Mutations ───────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: AgentFormData) => adminApi.post<any>("/admin-api/marketplace/agents", data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-agents"] });
      toast("Agent created", "success");
      navigate({ to: "/marketplace/agents/$agentId", params: { agentId: created.id } });
    },
    onError: (err: any) => toast(err.message ?? "Failed to create agent", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AgentFormData>) =>
      adminApi.patch(`/admin-api/marketplace/agents/${agentId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-agents"] });
      qc.invalidateQueries({ queryKey: ["admin-marketplace-agent", agentId] });
      savedRef.current = { ...form };
      toast("Agent updated", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to update agent", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.delete(`/admin-api/marketplace/agents/${agentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-agents"] });
      toast("Agent deleted");
      navigate({ to: "/marketplace/agents" });
    },
    onError: (err: any) => toast(err.message ?? "Failed to delete agent", "error"),
  });

  const save = () => {
    if (mode === "create") createMutation.mutate(form);
    else updateMutation.mutate(form);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const agentColor = form.avatarUrl?.startsWith("color:") ? form.avatarUrl.slice(6) : AGENT_COLORS[0];

  // ─── AI Generation ───────────────────────────────────────────────

  const generatePrompt = async () => {
    setIsGenerating(true);
    try {
      const resp = await adminApi.post<{ content?: string; error?: string }>("/admin-api/marketplace/agents/generate-prompt", {
        modelId: form.modelId || undefined,
        name: form.name || undefined,
        description: form.description || undefined,
        currentPrompt: form.systemPrompt || undefined,
        starters: form.starters.filter(Boolean),
      });
      if (resp.error) {
        toast(resp.error, "error");
        return;
      }
      const content = resp.content ?? "";
      // Try to parse as JSON (may contain name, description, starters, systemPrompt)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.systemPrompt) setField("systemPrompt", parsed.systemPrompt);
          if (parsed.name && !form.name) setField("name", parsed.name);
          if (parsed.description && !form.description) setField("description", parsed.description);
          if (parsed.starters?.length && !form.starters.filter(Boolean).length) setField("starters", parsed.starters);
          return;
        } catch {}
      }
      // Plain text — treat as system prompt
      setField("systemPrompt", content);
    } catch (err: any) {
      toast(err.message ?? "Failed to generate prompt", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  if (mode === "edit" && agentLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded skeleton" />
        <div className="h-64 rounded-xl skeleton" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/marketplace/agents" })}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${agentColor}15` }}>
            <Bot className="h-5 w-5" style={{ color: agentColor }} />
          </div>
          <div>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Agent name"
              maxLength={200}
              className="block text-lg font-bold tracking-tight bg-transparent border-none outline-none p-0"
              style={{ color: "var(--color-text-primary)" }}
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Brief description…"
              maxLength={2000}
              className="block text-xs bg-transparent border-none outline-none p-0 mt-0.5 w-80"
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              style={{ color: "var(--color-accent-red)" }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button
            onClick={save}
            disabled={isSaving || (mode === "edit" && !isDirty) || (mode === "create" && !form.name.trim())}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: "var(--color-accent-blue)", color: "#fff" }}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving…" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 min-h-0 rounded-xl border overflow-hidden" style={{ borderColor: "var(--color-border-subtle)" }}>
        <SplitPaneLayout
          storageKey="nova-admin:agent-builder-split"
          accentColor={agentColor}
          left={
            <ConfigPanel
              form={form}
              setField={setField}
              modelsList={modelsList}
              agentColor={agentColor}
              hasModels={hasModels}
              isGenerating={isGenerating}
              generatePrompt={generatePrompt}
            />
          }
          right={<AgentPreviewPanel form={form} />}
        />
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border p-6 max-w-sm w-full space-y-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)" }}>
            <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>Delete Agent</h3>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Are you sure you want to delete <strong>{form.name}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteDialog(false)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5" style={{ color: "var(--color-text-secondary)" }}>Cancel</button>
              <button onClick={() => { deleteMutation.mutate(); setShowDeleteDialog(false); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--color-accent-red)", color: "#fff" }}>
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Config Panel (left pane) ────────────────────────────────────────
// Section order mirrors the main web app: System Prompt → Model & Behaviour → Colour → Starters

function ConfigPanel({
  form,
  setField,
  modelsList,
  agentColor,
  hasModels,
  isGenerating,
  generatePrompt,
}: {
  form: AgentFormData;
  setField: <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => void;
  modelsList: any[];
  agentColor: string;
  hasModels: boolean;
  isGenerating: boolean;
  generatePrompt: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* 1. System Prompt */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Sparkles className="h-3.5 w-3.5" /> System Prompt
        </h2>
        <textarea
          value={form.systemPrompt}
          onChange={(e) => setField("systemPrompt", e.target.value)}
          placeholder="You are a helpful assistant that…"
          rows={10}
          className="w-full rounded-lg border px-3 py-2 text-xs font-mono leading-relaxed resize-y"
          style={inputStyle}
        />
        {hasModels && (
          <button
            onClick={generatePrompt}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${agentColor}12, ${agentColor}06)`,
              color: agentColor,
              border: `1px solid ${agentColor}20`,
            }}
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isGenerating
              ? "Generating…"
              : form.systemPrompt
                ? "Improve with AI"
                : "Generate with AI"
            }
          </button>
        )}
      </section>

      {/* 2. Model & Behaviour */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Settings2 className="h-3.5 w-3.5" /> Model & Behaviour
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Model</label>
            <select value={form.modelId} onChange={(e) => setField("modelId", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              <option value="">Default</option>
              {modelsList.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Visibility</label>
            <select value={form.visibility} onChange={(e) => setField("visibility", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Tool Approval</label>
            <select value={form.toolApprovalMode} onChange={(e) => setField("toolApprovalMode", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              {TOOL_APPROVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Execution Tier</label>
            <select value={form.defaultTier} onChange={(e) => setField("defaultTier", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              {TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Effort Level</label>
            <select value={form.effortLevel} onChange={(e) => setField("effortLevel", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              {EFFORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setField("isPublished", !form.isPublished)}
              className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-all"
              style={{
                background: form.isPublished ? "var(--color-accent-green-dim)" : "var(--color-surface-overlay)",
                borderColor: form.isPublished ? "var(--color-accent-green)" : "var(--color-border-default)",
                color: form.isPublished ? "var(--color-accent-green)" : "var(--color-text-muted)",
              }}
            >
              {form.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {form.isPublished ? "Published" : "Draft"}
            </button>
          </div>
        </div>
      </section>

      {/* 3. Colour */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Palette className="h-3.5 w-3.5" /> Colour
        </h2>
        <div className="flex gap-2 flex-wrap">
          {AGENT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setField("avatarUrl", `color:${c}`)}
              className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: agentColor === c ? "#fff" : "transparent",
                boxShadow: agentColor === c ? `0 0 0 2px ${c}` : "none",
              }}
            />
          ))}
        </div>
      </section>

      {/* 4. Conversation Starters */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            <MessageSquare className="h-3.5 w-3.5" /> Conversation Starters
          </h2>
          {form.starters.length < 6 && (
            <button
              onClick={() => setField("starters", [...form.starters, ""])}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:bg-white/5"
              style={{ color: "var(--color-accent-blue)" }}
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
        {form.starters.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            No starters yet. Add up to 6 suggested prompts for users.
          </p>
        ) : (
          <div className="space-y-2">
            {form.starters.map((starter, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={starter}
                  onChange={(e) => {
                    const updated = [...form.starters];
                    updated[i] = e.target.value;
                    setField("starters", updated);
                  }}
                  placeholder={`Starter ${i + 1}`}
                  className="flex-1 h-8 rounded-lg border px-3 text-sm"
                  style={inputStyle}
                />
                <button
                  onClick={() => setField("starters", form.starters.filter((_, j) => j !== i))}
                  className="p-1 rounded hover:bg-white/5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
