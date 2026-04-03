import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, FileText } from "lucide-react";
import { clsx } from "clsx";
import { Dialog } from "../ui/Dialog";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

interface PromptTemplate {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  category?: string | null;
  icon?: string | null;
  color?: string | null;
  variables?: Record<string, unknown> | null;
}

interface PromptPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}

export function PromptPickerDialog({ open, onClose, onSelect }: PromptPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

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

  // Group by category
  const grouped = useMemo(() => {
    const groups = new Map<string, PromptTemplate[]>();
    for (const tmpl of filtered) {
      const cat = tmpl.category || "General";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(tmpl);
    }
    return groups;
  }, [filtered]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("prompts.pickTemplate", { defaultValue: "Use a Prompt Template" })}
      size="md"
    >
      <div className="space-y-3">
        {/* Search */}
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

        {/* Template list */}
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
                  {items.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => onSelect(tmpl.content)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl text-left hover:bg-surface-secondary transition-colors group"
                    >
                      <div className="shrink-0 mt-0.5">
                        <div className={clsx(
                          "h-8 w-8 rounded-lg flex items-center justify-center",
                          tmpl.color ? `bg-${tmpl.color}/10` : "bg-primary/10",
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
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
