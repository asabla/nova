import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, FileText, Plus, Sparkles, Eye, EyeOff,
  Lightbulb, Code2, Terminal, Database, Search, BookOpen, Mail, PenTool,
  BarChart3, Presentation, Megaphone, TrendingUp, Headphones, Receipt,
  Clock, UserPlus, FolderOpen, Globe, Workflow, Layers, FileSpreadsheet,
  Zap, Blocks, Paintbrush, Palette, LayoutDashboard, Award, GraduationCap,
  TestTube, GitBranch, Pencil, ClipboardCheck, Scale, Shield, Target,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/Toast";

const ICON_MAP: Record<string, LucideIcon> = {
  Lightbulb, FileText, Sparkles, Code2, Terminal, Database, Search, BookOpen,
  Mail, PenTool, BarChart3, Presentation, Megaphone, TrendingUp, Headphones,
  Receipt, Clock, UserPlus, FolderOpen, Globe, Workflow, Layers,
  FileSpreadsheet, Zap, Blocks, Paintbrush, Palette, LayoutDashboard, Award,
  GraduationCap, TestTube, GitBranch, Pencil, ClipboardCheck, Scale, Shield,
  Target, MessageSquare,
};

const COLOR_MAP: Record<string, string> = {
  "text-primary": "#6366f1",
  "text-success": "#22c55e",
  "text-warning": "#f59e0b",
  "text-danger": "#ef4444",
};

export const Route = createFileRoute("/_admin/marketplace/templates/")({
  component: MarketplaceTemplatesPage,
});

function MarketplaceTemplatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-marketplace-templates"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/marketplace/templates"),
  });

  const templates = data?.data ?? [];
  const published = templates.filter((t: any) => t.isPublished);
  const drafts = templates.filter((t: any) => !t.isPublished);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Marketplace Templates</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Curated prompt templates available to all organisations
          </p>
        </div>
        <Link
          to="/marketplace/templates/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: "var(--color-accent-blue)", color: "#fff" }}
        >
          <Plus className="h-3.5 w-3.5" /> Create Template
        </Link>
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
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>No marketplace templates yet</h3>
          <p className="text-sm max-w-md mx-auto mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Create your first prompt template to make it available across the platform.
          </p>
          <Link
            to="/marketplace/templates/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--color-accent-blue)", color: "#fff" }}
          >
            <Plus className="h-3.5 w-3.5" /> Create Template
          </Link>
        </div>
      ) : (
        <>
          {published.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider font-mono mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
                <Eye className="h-3.5 w-3.5" style={{ color: "var(--color-accent-green)" }} />
                Published ({published.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {published.map((t: any) => <TemplateCard key={t.id} template={t} />)}
              </div>
            </div>
          )}

          {drafts.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider font-mono mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
                <EyeOff className="h-3.5 w-3.5" />
                Drafts ({drafts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drafts.map((t: any) => <TemplateCard key={t.id} template={t} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: any }) {
  const qc = useQueryClient();

  const togglePublish = useMutation({
    mutationFn: () => adminApi.patch(`/admin-api/marketplace/templates/${template.id}`, { isPublished: !template.isPublished }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-marketplace-templates"] });
      toast(template.isPublished ? "Template unpublished" : "Template published", "success");
    },
    onError: (err: any) => toast(err.message ?? "Failed to update", "error"),
  });

  return (
    <Link
      to="/marketplace/templates/$templateId"
      params={{ templateId: template.id }}
      className="block rounded-xl border p-5 group transition-all duration-150 hover:border-opacity-60 cursor-pointer"
      style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}
    >
      <div className="flex items-start gap-3 mb-3">
        {(() => {
          const Icon = (template.icon && ICON_MAP[template.icon]) || FileText;
          const iconColor = (template.color && COLOR_MAP[template.color]) || "#f59e0b";
          return (
            <div className="p-2 rounded-lg" style={{ background: `${iconColor}15` }}>
              <Icon className="h-4 w-4" style={{ color: iconColor }} />
            </div>
          );
        })()}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>{template.name}</h3>
          {template.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{template.description}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: template.isPublished ? "var(--color-accent-green-dim)" : "var(--color-surface-overlay)",
              color: template.isPublished ? "var(--color-accent-green)" : "var(--color-text-muted)",
            }}
          >
            {template.isPublished ? "Published" : "Draft"}
          </span>
          {template.category && (
            <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-muted)" }}>
              {template.category}
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePublish.mutate(); }}
          disabled={togglePublish.isPending}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold hover:bg-white/5 disabled:opacity-40"
          style={{ color: template.isPublished ? "var(--color-text-muted)" : "var(--color-accent-green)" }}
        >
          {template.isPublished ? <><EyeOff className="h-3 w-3" /> Unpublish</> : <><Eye className="h-3 w-3" /> Publish</>}
        </button>
      </div>
    </Link>
  );
}
