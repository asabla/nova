import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Save, Trash2, FileText, Plus, X,
  Sparkles, Tag, Code2, Type, Upload, ToggleLeft,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/Toast";
import { SplitPaneLayout } from "./SplitPaneLayout";

// ─── Types ───────────────────────────────────────────────────────────

interface TemplateInput {
  id: string;
  type: "text" | "textarea" | "file";
  label: string;
  placeholder: string;
  required: boolean;
  accept?: string;
}

interface TemplateFormData {
  name: string;
  description: string;
  content: string;
  systemPrompt: string;
  category: string;
  tags: string[];
  visibility: string;
  icon: string;
  color: string;
  bgColor: string;
  inputs: TemplateInput[];
}

const DEFAULT_FORM: TemplateFormData = {
  name: "",
  description: "",
  content: "",
  systemPrompt: "",
  category: "",
  tags: [],
  visibility: "org",
  icon: "",
  color: "",
  bgColor: "",
  inputs: [],
};

// ─── Styles ──────────────────────────────────────────────────────────

const card = { background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" };
const inputStyle = { background: "var(--color-surface-overlay)", borderColor: "var(--color-border-default)", color: "var(--color-text-primary)" };
const labelClass = "block text-[11px] font-semibold uppercase tracking-wider font-mono mb-1.5";

const CATEGORY_OPTIONS = [
  "", "General", "Business", "Productivity", "Code", "Design",
  "Research", "Creative", "Analysis", "Education",
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "team", label: "Team" },
  { value: "org", label: "Organisation" },
];

const ICON_OPTIONS = [
  "Lightbulb", "FileText", "Sparkles", "Code2", "Terminal", "Database",
  "Search", "BookOpen", "Mail", "PenTool", "BarChart3", "Presentation",
  "Megaphone", "TrendingUp", "Headphones", "Receipt", "Clock", "UserPlus",
  "FolderOpen", "Globe", "Workflow", "Layers", "FileSpreadsheet", "Zap",
  "Blocks", "Paintbrush", "Palette", "LayoutDashboard", "Award",
  "GraduationCap", "TestTube", "GitBranch", "Pencil", "ClipboardCheck",
  "Scale", "Shield", "Target", "MessageSquare",
];

const COLOR_OPTIONS = [
  { value: "text-primary", label: "Primary" },
  { value: "text-blue-500", label: "Blue" },
  { value: "text-purple-500", label: "Purple" },
  { value: "text-pink-500", label: "Pink" },
  { value: "text-red-500", label: "Red" },
  { value: "text-orange-500", label: "Orange" },
  { value: "text-amber-500", label: "Amber" },
  { value: "text-green-500", label: "Green" },
  { value: "text-teal-500", label: "Teal" },
  { value: "text-cyan-500", label: "Cyan" },
];

// ─── Component ───────────────────────────────────────────────────────

export function TemplateForm({ mode, templateId }: { mode: "create" | "edit"; templateId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<TemplateFormData>(DEFAULT_FORM);
  const savedRef = useRef<TemplateFormData>(DEFAULT_FORM);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const setField = <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Queries ─────────────────────────────────────────────────────

  const { data: template, isLoading } = useQuery({
    queryKey: ["admin-marketplace-template", templateId],
    queryFn: () => adminApi.get<any>(`/admin-api/marketplace/templates/${templateId}`),
    enabled: mode === "edit" && !!templateId,
  });

  useEffect(() => {
    if (template) {
      const loaded: TemplateFormData = {
        name: template.name ?? "",
        description: template.description ?? "",
        content: template.content ?? "",
        systemPrompt: template.systemPrompt ?? "",
        category: template.category ?? "",
        tags: (template.tags as string[]) ?? [],
        visibility: template.visibility ?? "org",
        icon: template.icon ?? "",
        color: template.color ?? "",
        bgColor: template.bgColor ?? "",
        inputs: (template.inputs as TemplateInput[]) ?? [],
      };
      setForm(loaded);
      savedRef.current = loaded;
    }
  }, [template]);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);

  // ─── Mutations ───────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: TemplateFormData) => adminApi.post<any>("/admin-api/marketplace/templates", data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-templates"] });
      toast("Template created", "success");
      navigate({ to: "/marketplace/templates/$templateId", params: { templateId: created.id } });
    },
    onError: (err: any) => toast(err.message ?? "Failed to create template", "error"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TemplateFormData>) =>
      adminApi.patch(`/admin-api/marketplace/templates/${templateId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-templates"] });
      qc.invalidateQueries({ queryKey: ["admin-marketplace-template", templateId] });
      savedRef.current = { ...form };
      toast("Template updated", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to update template", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.delete(`/admin-api/marketplace/templates/${templateId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-templates"] });
      toast("Template deleted");
      navigate({ to: "/marketplace/templates" });
    },
    onError: (err: any) => toast(err.message ?? "Failed to delete template", "error"),
  });

  const save = () => {
    if (mode === "create") createMutation.mutate(form);
    else updateMutation.mutate(form);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag) && form.tags.length < 20) {
      setField("tags", [...form.tags, tag]);
      setTagInput("");
    }
  };

  const addInput = () => {
    setField("inputs", [
      ...form.inputs,
      { id: `input_${Date.now()}`, type: "text", label: "", placeholder: "", required: false },
    ]);
  };

  // ─── Render ──────────────────────────────────────────────────────

  if (mode === "edit" && isLoading) {
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
            onClick={() => navigate({ to: "/marketplace/templates" })}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--color-text-muted)" }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="p-2 rounded-lg" style={{ background: "var(--color-accent-amber-dim)" }}>
            <FileText className="h-5 w-5" style={{ color: "var(--color-accent-amber)" }} />
          </div>
          <div>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Template name"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:bg-white/5"
              style={{ color: "var(--color-accent-red)" }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button
            onClick={save}
            disabled={isSaving || (mode === "edit" && !isDirty) || (mode === "create" && (!form.name.trim() || !form.content.trim()))}
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
          storageKey="nova-admin:template-builder-split"
          left={
            <TemplateConfigPanel
              form={form}
              setField={setField}
              tagInput={tagInput}
              setTagInput={setTagInput}
              addTag={addTag}
              addInput={addInput}
            />
          }
          right={<TemplatePreviewPanel form={form} />}
        />
      </div>

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border p-6 max-w-sm w-full space-y-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)" }}>
            <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>Delete Template</h3>
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

function TemplateConfigPanel({
  form,
  setField,
  tagInput,
  setTagInput,
  addTag,
  addInput,
}: {
  form: TemplateFormData;
  setField: <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  addTag: () => void;
  addInput: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Content */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Code2 className="h-3.5 w-3.5" /> Template Content
        </h2>
        <textarea
          value={form.content}
          onChange={(e) => setField("content", e.target.value)}
          placeholder={"Write your template here…\nUse {{variable}} for dynamic placeholders."}
          rows={12}
          className="w-full rounded-lg border px-3 py-2 text-xs font-mono leading-relaxed resize-y"
          style={inputStyle}
        />
      </section>

      {/* System Prompt */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Sparkles className="h-3.5 w-3.5" /> System Prompt
        </h2>
        <textarea
          value={form.systemPrompt}
          onChange={(e) => setField("systemPrompt", e.target.value)}
          placeholder="Optional system-level instructions…"
          rows={5}
          className="w-full rounded-lg border px-3 py-2 text-xs font-mono leading-relaxed resize-y"
          style={inputStyle}
        />
      </section>

      {/* Metadata */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
          <Tag className="h-3.5 w-3.5" /> Metadata
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Category</label>
            <select value={form.category} onChange={(e) => setField("category", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c || "None"}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Visibility</label>
            <select value={form.visibility} onChange={(e) => setField("visibility", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Icon</label>
            <select value={form.icon} onChange={(e) => setField("icon", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              <option value="">Default</option>
              {ICON_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Colour</label>
            <select value={form.color} onChange={(e) => setField("color", e.target.value)} className="w-full h-9 rounded-lg border px-3 text-sm appearance-none" style={inputStyle}>
              <option value="">Default</option>
              {COLOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={labelClass} style={{ color: "var(--color-text-muted)" }}>Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.tags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
                {tag}
                <button onClick={() => setField("tags", form.tags.filter((_, j) => j !== i))} className="hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Add tag…"
              className="flex-1 h-8 rounded-lg border px-3 text-sm"
              style={inputStyle}
            />
            <button onClick={addTag} className="px-2 h-8 rounded-lg text-xs font-medium" style={{ color: "var(--color-accent-blue)" }}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Structured Inputs */}
      <section className="rounded-xl border p-5 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            <Type className="h-3.5 w-3.5" /> Input Fields
          </h2>
          {form.inputs.length < 10 && (
            <button onClick={addInput} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium hover:bg-white/5" style={{ color: "var(--color-accent-blue)" }}>
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
        {form.inputs.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Optional. Define structured inputs for the template.
          </p>
        ) : (
          <div className="space-y-3">
            {form.inputs.map((inp, i) => (
              <div key={inp.id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--color-border-default)", background: "var(--color-surface-overlay)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>Input {i + 1}</span>
                  <button
                    onClick={() => setField("inputs", form.inputs.filter((_, j) => j !== i))}
                    className="p-0.5 rounded hover:bg-white/5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={inp.label}
                    onChange={(e) => {
                      const updated = [...form.inputs];
                      updated[i] = { ...updated[i], label: e.target.value };
                      setField("inputs", updated);
                    }}
                    placeholder="Label"
                    className="h-8 rounded-md border px-2 text-xs"
                    style={inputStyle}
                  />
                  <select
                    value={inp.type}
                    onChange={(e) => {
                      const updated = [...form.inputs];
                      updated[i] = { ...updated[i], type: e.target.value as any };
                      setField("inputs", updated);
                    }}
                    className="h-8 rounded-md border px-2 text-xs appearance-none"
                    style={inputStyle}
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="file">File</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={inp.placeholder}
                  onChange={(e) => {
                    const updated = [...form.inputs];
                    updated[i] = { ...updated[i], placeholder: e.target.value };
                    setField("inputs", updated);
                  }}
                  placeholder="Placeholder text"
                  className="w-full h-8 rounded-md border px-2 text-xs"
                  style={inputStyle}
                />
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={inp.required}
                    onChange={(e) => {
                      const updated = [...form.inputs];
                      updated[i] = { ...updated[i], required: e.target.checked };
                      setField("inputs", updated);
                    }}
                    className="rounded"
                  />
                  Required
                </label>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Preview Panel (right pane) ──────────────────────────────────────

function TemplatePreviewPanel({ form }: { form: TemplateFormData }) {
  // Highlight {{variables}} in content
  const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/({{[^}]+}})/g);
    return parts.map((part, i) =>
      part.startsWith("{{") && part.endsWith("}}") ? (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold mx-0.5"
          style={{ background: "var(--color-accent-blue-dim)", color: "var(--color-accent-blue)" }}
        >
          {part.slice(2, -2)}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Card Preview */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider font-mono mb-3" style={{ color: "var(--color-text-muted)" }}>
          Marketplace Card Preview
        </h3>
        <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2.5 rounded-lg" style={{ background: "var(--color-accent-amber-dim)" }}>
              <FileText className="h-5 w-5" style={{ color: "var(--color-accent-amber)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                {form.name || "Untitled Template"}
              </h4>
              {form.description && (
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{form.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {form.category && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
                {form.category}
              </span>
            )}
            {form.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-muted)" }}>
                {tag}
              </span>
            ))}
            {form.tags.length > 3 && (
              <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>+{form.tags.length - 3}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider font-mono mb-3" style={{ color: "var(--color-text-muted)" }}>
          Content Preview
        </h3>
        {form.content ? (
          <div className="rounded-xl border p-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-primary)" }}>
              {renderContent(form.content)}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl border p-8 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Start typing to see a preview</p>
          </div>
        )}
      </div>

      {/* System Prompt Preview */}
      {form.systemPrompt && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider font-mono mb-3" style={{ color: "var(--color-text-muted)" }}>
            System Prompt
          </h3>
          <div className="rounded-xl border p-4" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>
              {form.systemPrompt}
            </pre>
          </div>
        </div>
      )}

      {/* Input Fields Preview */}
      {form.inputs.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider font-mono mb-3" style={{ color: "var(--color-text-muted)" }}>
            Input Fields Preview
          </h3>
          <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
            {form.inputs.map((inp) => (
              <div key={inp.id}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                  {inp.label || "Untitled"}
                  {inp.required && <span style={{ color: "var(--color-accent-red)" }}> *</span>}
                </label>
                {inp.type === "textarea" ? (
                  <div className="h-16 rounded-lg border px-3 py-2 text-xs" style={{ ...inputStyle, opacity: 0.6 }}>
                    {inp.placeholder}
                  </div>
                ) : inp.type === "file" ? (
                  <div className="h-9 rounded-lg border px-3 flex items-center text-xs" style={{ ...inputStyle, opacity: 0.6 }}>
                    <Upload className="h-3 w-3 mr-2" style={{ color: "var(--color-text-muted)" }} />
                    {inp.placeholder || "Choose file…"}
                  </div>
                ) : (
                  <div className="h-9 rounded-lg border px-3 flex items-center text-xs" style={{ ...inputStyle, opacity: 0.6 }}>
                    {inp.placeholder}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
