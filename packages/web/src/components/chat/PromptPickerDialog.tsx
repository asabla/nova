import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, FileText, ArrowLeft, Send } from "lucide-react";
import { clsx } from "clsx";
import { Dialog } from "../ui/Dialog";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

interface TemplateVariable {
  name: string;
  description: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  category?: string | null;
  icon?: string | null;
  color?: string | null;
  variables?: TemplateVariable[] | null;
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

export function PromptPickerDialog({ open, onClose, onSelect }: PromptPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

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

  const handleSelectTemplate = useCallback((tmpl: PromptTemplate) => {
    const vars = tmpl.variables?.length
      ? tmpl.variables.map((v) => v.name)
      : extractVariables(tmpl.content);

    if (vars.length === 0) {
      // No variables — insert directly
      onSelect(tmpl.content);
      return;
    }

    // Show variable fill step
    setSelectedTemplate(tmpl);
    setVariableValues({});
  }, [onSelect]);

  const handleBack = useCallback(() => {
    setSelectedTemplate(null);
    setVariableValues({});
  }, []);

  const handleSubmitVariables = useCallback(() => {
    if (!selectedTemplate) return;
    const result = interpolate(selectedTemplate.content, variableValues);
    onSelect(result);
    setSelectedTemplate(null);
    setVariableValues({});
  }, [selectedTemplate, variableValues, onSelect]);

  const handleClose = useCallback(() => {
    setSelectedTemplate(null);
    setVariableValues({});
    setSearch("");
    onClose();
  }, [onClose]);

  // Get variable definitions: prefer schema variables, fall back to extracting from content
  const currentVariables: TemplateVariable[] = useMemo(() => {
    if (!selectedTemplate) return [];
    if (selectedTemplate.variables?.length) return selectedTemplate.variables;
    return extractVariables(selectedTemplate.content).map((name) => ({
      name,
      description: name.replace(/_/g, " "),
    }));
  }, [selectedTemplate]);

  // Preview the interpolated content
  const preview = useMemo(() => {
    if (!selectedTemplate) return "";
    return interpolate(selectedTemplate.content, variableValues);
  }, [selectedTemplate, variableValues]);

  const allFilled = currentVariables.every((v) => variableValues[v.name]?.trim());

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        selectedTemplate
          ? selectedTemplate.name
          : t("prompts.pickTemplate", { defaultValue: "Use a Prompt Template" })
      }
      size="md"
    >
      {selectedTemplate ? (
        /* ── Variable fill step ── */
        <div className="space-y-4">
          {selectedTemplate.description && (
            <p className="text-xs text-text-tertiary">{selectedTemplate.description}</p>
          )}

          {/* Variable inputs */}
          <div className="space-y-3">
            {currentVariables.map((v) => {
              const isLong = v.name === "code" || v.name === "contract" || v.name === "policy"
                || v.name === "document" || v.name === "original" || v.name === "material"
                || v.name === "feedback" || v.name === "notes" || v.name === "diff"
                || v.name === "schema" || v.description.length > 40;

              return (
                <div key={v.name}>
                  <label className="block text-xs font-medium text-text mb-1 capitalize">
                    {v.description || v.name.replace(/_/g, " ")}
                  </label>
                  {isLong ? (
                    <textarea
                      value={variableValues[v.name] ?? ""}
                      onChange={(e) => setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                      placeholder={v.description}
                      rows={4}
                      className="w-full text-sm bg-surface-secondary border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder:text-text-tertiary resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      value={variableValues[v.name] ?? ""}
                      onChange={(e) => setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                      placeholder={v.description}
                      className="w-full h-9 text-sm bg-surface-secondary border border-border rounded-xl px-3 focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder:text-text-tertiary"
                      autoFocus={currentVariables.indexOf(v) === 0}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview */}
          {Object.values(variableValues).some((v) => v.trim()) && (
            <div>
              <p className="text-xs font-medium text-text-tertiary mb-1">Preview</p>
              <pre className="text-xs text-text-secondary bg-surface-secondary rounded-xl p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                {preview}
              </pre>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> {t("common.back", "Back")}
            </button>
            <button
              onClick={handleSubmitVariables}
              disabled={!allFilled}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                allFilled
                  ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                  : "bg-surface-tertiary text-text-tertiary cursor-not-allowed",
              )}
            >
              <Send className="h-3.5 w-3.5" /> {t("prompts.useTemplate", { defaultValue: "Use Template" })}
            </button>
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
                      const vars = tmpl.variables?.length
                        ? tmpl.variables
                        : extractVariables(tmpl.content).map((n) => ({ name: n, description: n }));
                      const hasVars = vars.length > 0;

                      return (
                        <button
                          key={tmpl.id}
                          onClick={() => handleSelectTemplate(tmpl)}
                          className="w-full flex items-start gap-3 p-3 rounded-xl text-left hover:bg-surface-secondary transition-colors group"
                        >
                          <div className="shrink-0 mt-0.5">
                            <div className={clsx(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              "bg-primary/10",
                            )}>
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
                                {vars.map((v) => (
                                  <span key={v.name} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-text-tertiary">
                                    {v.name}
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
