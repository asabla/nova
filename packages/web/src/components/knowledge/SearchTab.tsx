import { useState } from "react";
import { Search, FileText, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { toast } from "../ui/Toast";
import { api } from "../../lib/api";
import type { RetrievedChunk } from "./types";

interface SearchTabProps {
  collectionId: string;
  onViewDocument?: (documentId: string) => void;
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? "bg-success" : score >= 0.5 ? "bg-warning" : "bg-text-tertiary";
  const textColor = score >= 0.8 ? "text-success" : score >= 0.5 ? "text-warning" : "text-text-tertiary";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-surface-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${textColor}`}>{pct}%</span>
    </div>
  );
}

export function SearchTab({ collectionId, onViewDocument }: SearchTabProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    setExpandedIds(new Set());
    try {
      const result = await api.post<{ data: RetrievedChunk[] }>(`/api/knowledge/${collectionId}/query`, {
        query,
        topK: 5,
      });
      setResults((result as any)?.data ?? []);
    } catch (err: any) {
      toast.error(err.message ?? t("knowledge.queryFailed", { defaultValue: "Query failed" }));
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          {t("knowledge.search", { defaultValue: "Search" })}
        </label>
        <p className="text-xs text-text-secondary mb-3">
          {t("knowledge.searchDesc", { defaultValue: "Enter a natural language query to find relevant content in this collection." })}
        </p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface input-glow">
            <Search className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("knowledge.searchPlaceholder", { defaultValue: "What is the refund policy?" })}
              className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-text-tertiary"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
          </div>
          <Button variant="primary" onClick={handleSearch} disabled={loading || !query.trim()}>
            <Search className="h-4 w-4" aria-hidden="true" />
            {loading ? t("knowledge.searching", { defaultValue: "Searching..." }) : t("knowledge.search", { defaultValue: "Search" })}
          </Button>
        </div>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">
              {t("knowledge.results", { defaultValue: "Results" })} ({results.length})
            </h3>
            {results.length > 0 && (
              <span className="text-xs text-text-tertiary">{t("knowledge.sortedByRelevance", { defaultValue: "Sorted by relevance" })}</span>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={<Search className="h-7 w-7" />}
              title={t("knowledge.noResults", { defaultValue: "No relevant results found" })}
              description={t("knowledge.noResultsHint", { defaultValue: "Try a different query, or make sure documents have been indexed." })}
            />
          ) : (
            results.map((chunk) => {
              const isExpanded = expandedIds.has(chunk.id);
              const contentLines = chunk.content.split("\n");
              const isLong = contentLines.length > 4 || chunk.content.length > 400;
              const preview = isLong && !isExpanded
                ? chunk.content.slice(0, 400) + (chunk.content.length > 400 ? "..." : "")
                : chunk.content;

              return (
                <div
                  key={chunk.id}
                  className="rounded-lg border border-border bg-surface overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-2.5 bg-surface-secondary border-b border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium text-text truncate">{chunk.documentName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <RelevanceBar score={chunk.score} />
                      {onViewDocument && (
                        <button
                          onClick={() => onViewDocument(chunk.documentId)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          {t("knowledge.viewInDocument", { defaultValue: "View in document" })}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                      {preview}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => toggleExpand(chunk.id)}
                        className="text-xs text-primary hover:text-primary/80 mt-1"
                      >
                        {isExpanded
                          ? t("common.showLess", { defaultValue: "Show less" })
                          : t("common.showMore", { defaultValue: "Show more" })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
