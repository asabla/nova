import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

interface TemplateVariable {
  name: string;
  description: string;
}

interface TemplateInput {
  id: string;
  type: "text" | "textarea" | "file";
  label: string;
  placeholder: string;
  required: boolean;
}

interface PromptTemplate {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  category?: string | null;
  icon?: string | null;
  color?: string | null;
  bgColor?: string | null;
  variables?: TemplateVariable[] | null;
  inputs?: TemplateInput[] | null;
}

interface PromptPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

function interpolate(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

/** Convert template variables or extracted vars into TemplateInput-like objects */
function buildInputs(tmpl: PromptTemplate): TemplateInput[] {
  // Prefer the structured inputs field (used by explore templates)
  if (tmpl.inputs?.length) {
    return tmpl.inputs.filter((i) => i.type !== "file");
  }

  // Fall back to variables array
  const vars = tmpl.variables?.length
    ? tmpl.variables
    : extractVariables(tmpl.content).map((name) => ({ name, description: name.replace(/_/g, " ") }));

  return vars.map((v) => {
    const isLong = ["code", "contract", "policy", "document", "original", "material",
      "feedback", "notes", "diff", "schema", "content"].includes(v.name)
      || v.description.length > 50;

    return {
      id: v.name,
      type: isLong ? "textarea" as const : "text" as const,
      label: v.description || v.name.replace(/_/g, " "),
      placeholder: v.description || v.name.replace(/_/g, " "),
      required: true,
    };
  });
}

export function PromptPickerDialog({ open, onClose, onSelect }: PromptPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.prompts.all, "list"],
    queryFn: () => api.get<any>("/api/prompts?limit=100"),
    enabled: open,
    staleTime: 30_000,
  });

  const templates: PromptTemplate[] = (data as any)?.data ?? [];

  const filtered = useMemo(
    () =>
      search
        ? templates.filter(
            (t) =>
              t.name.toLowerCase().includes(search.toLowerCase()) ||
              t.description?.toLowerCase().includes(search.toLowerCase()) ||
              t.category?.toLowerCase().includes(search.toLowerCase()),
          )
        : templates,
    [templates, search],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, PromptTemplate[]>();
    for (const tmpl of filtered) {
      const cat = tmpl.category || "General";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(tmpl);
    }
    return groups;
  }, [filtered]);

  const inputs = useMemo(() => selectedTemplate ? buildInputs(selectedTemplate) : [], [selectedTemplate]);

  const handleSelectTemplate = useCallback((tmpl: PromptTemplate) => {
    const tmplInputs = buildInputs(tmpl);
    if (tmplInputs.length === 0) {
      onSelect(tmpl.content);
      return;
    }
    setSelectedTemplate(tmpl);
    setValues({});
  }, [onSelect]);

  const handleBack = useCallback(() => {
    setSelectedTemplate(null);
    setValues({});
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedTemplate) return;
    const result = interpolate(selectedTemplate.content, values);
    onSelect(result);
    setSelectedTemplate(null);
    setValues({});
  }, [selectedTemplate, values, onSelect]);

  const handleClose = useCallback(() => {
    setSelectedTemplate(null);
    setValues({});
    setSearch("");
    onClose();
  }, [onClose]);

  const handleChange = useCallback((id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const allFilled = inputs.filter((i) => i.required).every((i) => values[i.id]?.trim());

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={selectedTemplate?.name ?? t("prompts.pickTemplate", { defaultValue: "Use a Prompt Template" })}
      size={selectedTemplate ? "lg" : "md"}
    >
      {selectedTemplate ? (
        /* ── Variable fill step (matches explore TemplateInputDialog) ── */
        <div>
          {/* Context header */}
          <div className="flex items-start gap-3 mb-6 p-3 rounded-lg bg-surface-secondary">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {selectedTemplate.description}
            </p>
          </div>

          {/* Input fields */}
          <div className="space-y-5">
            {inputs.map((input, idx) => (
              <div key={input.id}>
                <label htmlFor={`prompt-${input.id}`} className="block text-sm font-medium text-text mb-1.5">
                  {input.label}
                </label>
                {input.type === "textarea" ? (
                  <textarea
                    id={`prompt-${input.id}`}
                    value={values[input.id] ?? ""}
                    onChange={(e) => handleChange(input.id, e.target.value)}
                    placeholder={input.placeholder}
                    rows={6}
                    autoFocus={idx === 0}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm text-text bg-surface placeholder:text-text-tertiary resize-y min-h-[120px] max-h-[320px] font-mono transition-colors border-border focus:border-primary focus:ring-primary/20 focus:outline-none focus:ring-2"
                  />
                ) : (
                  <input
                    type="text"
                    id={`prompt-${input.id}`}
                    value={values[input.id] ?? ""}
                    onChange={(e) => handleChange(input.id, e.target.value)}
                    placeholder={input.placeholder}
                    autoFocus={idx === 0}
                    className="w-full px-3 py-2.5 rounded-lg border text-sm text-text bg-surface placeholder:text-text-tertiary transition-colors border-border focus:border-primary focus:ring-primary/20 focus:outline-none focus:ring-2"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Actions — matching explore modal */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("common.back", "Back")}
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!allFilled}>
              {t("prompts.useTemplate", { defaultValue: "Use Template" })}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        /* ── Template list step ── */
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" aria-hidden="true" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("prompts.searchTemplates", { defaultValue: "Search templates..." })}
              className="w-full h-10 pl-10 pr-4 text-sm bg-surface-secondary border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder:text-text-tertiary"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-4">
            {isLoading ? (
              <p className="text-sm text-text-tertiary text-center py-8">
                {t("common.loading")}
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-8">
                {search
                  ? t("prompts.noMatch", { defaultValue: "No templates match your search" })
                  : t("prompts.noTemplates", { defaultValue: "No prompt templates available" })}
              </p>
            ) : (
              Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5 px-1">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {items.map((tmpl) => {
                      const tmplInputs = buildInputs(tmpl);
                      const hasVars = tmplInputs.length > 0;

                      return (
                        <button
                          key={tmpl.id}
                          onClick={() => handleSelectTemplate(tmpl)}
                          className="w-full flex items-start gap-3 p-3 rounded-xl text-left hover:bg-surface-secondary transition-colors group"
                        >
                          <div className="shrink-0 mt-0.5">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                              {tmpl.name}
                            </p>
                            {tmpl.description && (
                              <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                                {tmpl.description}
                              </p>
                            )}
                            {hasVars && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {tmplInputs.map((input) => (
                                  <span key={input.id} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-text-tertiary">
                                    {input.id}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
