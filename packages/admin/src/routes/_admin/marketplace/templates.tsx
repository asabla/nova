import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, FileText, Sparkles } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/marketplace/templates")({
  component: MarketplaceTemplatesPage,
});

function MarketplaceTemplatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-marketplace-templates"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/marketplace/templates"),
  });

  const templates = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Marketplace Templates</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Curated prompt templates available to all organisations
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        <Link
          to="/marketplace/agents"
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Bot className="h-4 w-4" /> Agents
        </Link>
        <Link
          to="/marketplace/templates"
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2"
          style={{ borderColor: "var(--color-accent-blue)", color: "var(--color-accent-blue)" }}
        >
          <FileText className="h-4 w-4" /> Templates
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-xl skeleton" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <div className="inline-flex p-4 rounded-xl mb-4" style={{ background: "var(--color-accent-amber-dim)" }}>
            <Sparkles className="h-8 w-8" style={{ color: "var(--color-accent-amber)" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>No marketplace templates</h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--color-text-secondary)" }}>
            Create prompt templates in the system organisation to make them available across the platform.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template: any) => (
            <div key={template.id} className="rounded-xl border p-5 transition-all duration-150" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg" style={{ background: "var(--color-accent-amber-dim)" }}>
                  <FileText className="h-4 w-4" style={{ color: "var(--color-accent-amber)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{template.name}</h3>
                  {template.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{template.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}>
                  v{template.currentVersion ?? 1}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                  {new Date(template.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
