import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  MessageSquare,
  Code2,
  Search,
  Palette,
  BarChart3,
  ArrowRight,
  Sparkles,
  Bot,
  Star,
  Briefcase,
  GraduationCap,
  Paintbrush,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { TemplateInputDialog } from "../../components/explore/TemplateInputDialog";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { setPendingFiles } from "../../lib/pending-files";
import { resolveIcon } from "../../lib/template-icons";
import { getAgentColor, getAgentBgStyle, getAgentIconStyle } from "../../lib/agent-appearance";
import type { ApiTemplate, ExploreTemplate } from "../../types/template";

export const Route = createFileRoute("/_auth/explore")({
  component: ExplorePage,
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Category = "all" | "agents" | "general" | "business" | "productivity" | "code" | "design" | "research" | "creative" | "analysis" | "education";

const categories: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Compass },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "general", label: "General", icon: MessageSquare },
  { id: "business", label: "Business", icon: Briefcase },
  { id: "productivity", label: "Productivity", icon: ClipboardCheck },
  { id: "code", label: "Code", icon: Code2 },
  { id: "design", label: "Design", icon: Paintbrush },
  { id: "research", label: "Research", icon: Search },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "education", label: "Education", icon: GraduationCap },
];

/** Convert an API template to a renderable ExploreTemplate. */
function toExploreTemplate(t: ApiTemplate): ExploreTemplate {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    content: t.content,
    category: t.category ?? "general",
    tags: (t.tags as string[]) ?? [],
    inputs: t.inputs ?? undefined,
    icon: resolveIcon(t.icon),
    color: t.color ?? "text-primary",
    bgColor: t.bgColor ?? "bg-primary/10",
    isSystem: t.isSystem,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  onChat,
  onInstall,
}: {
  agent: any;
  onChat: (agent: any) => void;
  onInstall: (agent: any) => void;
}) {
  const isPlatform = agent.source === "platform";
  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={getAgentBgStyle(getAgentColor(agent))}>
          <Bot className="h-5 w-5" style={getAgentIconStyle(getAgentColor(agent))} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{agent.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isPlatform && (
              <Badge variant="default" className="text-[9px]">Marketplace</Badge>
            )}
            {agent.visibility && !isPlatform && (
              <Badge variant={agent.visibility === "public" ? "primary" : "default"} className="mt-0.5">
                {agent.visibility}
              </Badge>
            )}
          </div>
        </div>
      </div>
      {agent.description && (
        <p className="text-xs text-text-tertiary line-clamp-2 mb-3 flex-1">{agent.description}</p>
      )}
      <div className="flex items-center gap-2 mt-auto">
        {typeof agent.usageCount === "number" && (
          <div className="flex items-center gap-1 mr-auto">
            <Star className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
            <span className="text-[10px] text-text-tertiary">{agent.usageCount}</span>
          </div>
        )}
        {isPlatform && (
          <button
            onClick={() => onInstall(agent)}
            className="text-xs text-primary hover:text-primary-dark transition-colors"
          >
            Install
          </button>
        )}
        {!isPlatform && (
          <button
            onClick={() => onInstall(agent)}
            className="text-xs text-text-tertiary hover:text-text transition-colors"
          >
            View
          </button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onChat(agent)}>
          <MessageSquare className="h-3 w-3 mr-1" aria-hidden="true" />
          Chat
        </Button>
      </div>
    </div>
  );
}

function ConversationCard({
  template,
  onStart,
}: {
  template: ExploreTemplate;
  onStart: (template: ExploreTemplate) => void;
}) {
  const { t } = useTranslation();
  const Icon = template.icon;

  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 rounded-xl ${template.bgColor} flex items-center justify-center`}
        >
          <Icon className={`h-5 w-5 ${template.color}`} aria-hidden="true" />
        </div>
        <div className="flex gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface border border-border text-text-tertiary"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-text mb-1">
        {template.name}
      </h3>
      <p className="text-xs text-text-tertiary leading-relaxed mb-4 flex-1">
        {template.description}
      </p>

      <button
        onClick={() => onStart(template)}
        className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary-dark transition-colors group-hover:gap-3"
      >
        {t("explore.tryConversation", "Try this conversation")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ExplorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ExploreTemplate | null>(null);

  // Fetch templates from API
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: queryKeys.prompts.explore({ category: activeCategory !== "all" && activeCategory !== "agents" ? activeCategory : undefined }),
    queryFn: () => api.get<any>("/api/prompts/explore?limit=100" + (activeCategory !== "all" && activeCategory !== "agents" ? `&category=${activeCategory}` : "")),
    staleTime: 60_000,
  });

  const allTemplates: ExploreTemplate[] = useMemo(() => {
    const raw: ApiTemplate[] = (templatesData as any)?.data ?? [];
    return raw.map(toExploreTemplate);
  }, [templatesData]);

  // Fetch published agents
  const { data: agentsData } = useQuery({
    queryKey: ["agents-marketplace", "explore"],
    queryFn: () => api.get<any>("/api/agents/marketplace/browse"),
    staleTime: 60_000,
  });

  const publishedAgents: any[] = (agentsData as any)?.data ?? [];

  const filteredConversations = useMemo(() => {
    let result = allTemplates;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [allTemplates, searchQuery]);

  const filteredAgents = useMemo(() => {
    let result = publishedAgents;

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q),
      );
    }

    return result.slice(0, activeCategory === "agents" ? 12 : 6);
  }, [publishedAgents, activeCategory, searchQuery]);

  const showAgents = filteredAgents.length > 0;
  const showConversations = activeCategory !== "agents";

  const handleStartConversation = (template: ExploreTemplate) => {
    if (template.inputs?.length) {
      setSelectedTemplate(template);
      return;
    }
    try {
      sessionStorage.setItem("nova:starter-message", template.content);
    } catch {
      // sessionStorage unavailable
    }
    navigate({ to: "/conversations/new" });
  };

  const handleTemplateSubmit = (resolvedMessage: string, files?: File[]) => {
    if (files?.length) {
      setPendingFiles(files);
    }
    try {
      sessionStorage.setItem("nova:starter-message", resolvedMessage);
    } catch {
      // sessionStorage unavailable
    }
    setSelectedTemplate(null);
    navigate({ to: "/conversations/new" });
  };

  const handleChatWithAgent = (agent: any) => {
    navigate({ to: "/conversations/new", search: { agentId: agent.id } });
  };

  const handleInstallAgent = async (agent: any) => {
    if (agent.source === "platform") {
      try {
        const installed = await api.post<any>(`/api/agents/marketplace/${agent.id}/install`);
        navigate({ to: `/agents/${installed.id}` });
      } catch {
        // If already installed or fails, go to marketplace page
        navigate({ to: "/agents/marketplace" });
      }
    } else {
      navigate({ to: `/agents/${agent.id}` });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Compass className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">{t("explore.title", "Explore")}</h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {t("explore.subtitle", "Discover agents and sample conversations to get started with NOVA.")}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-6 input-glow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("explore.searchPlaceholder", "Search agents and conversations...")}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary transition-colors"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap max-w-2xl mx-auto">
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-secondary border border-border text-text-secondary hover:text-text hover:border-border-strong"
                }`}
              >
                <CatIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Featured Agents */}
        {showAgents && filteredAgents.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text">
                {t("explore.featuredAgents", "Agents")}
              </h2>
              <button
                onClick={() => navigate({ to: "/agents/marketplace" })}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
              >
                {t("explore.viewAllAgents", "View all")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent: any) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onChat={handleChatWithAgent}
                  onInstall={handleInstallAgent}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sample Conversations */}
        {showConversations && (
          <>
            {showAgents && filteredAgents.length > 0 && (
              <h2 className="text-lg font-semibold text-text mb-4">
                {t("explore.sampleConversations", "Get Started")}
              </h2>
            )}

            {templatesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
              </div>
            ) : filteredConversations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConversations.map((tmpl) => (
                  <ConversationCard
                    key={tmpl.id}
                    template={tmpl}
                    onStart={handleStartConversation}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-text-secondary">
                  {t("explore.noResults", "No results matching your search")}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                  className="text-xs text-primary hover:text-primary-dark mt-2 underline"
                >
                  {t("explore.clearFilters", "Clear filters")}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state for agents-only filter with no agents */}
        {activeCategory === "agents" && filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <Bot className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              {searchQuery
                ? t("explore.noAgentsSearch", "No agents matching your search")
                : t("explore.noAgentsPublished", "No published agents yet")}
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-text-tertiary mb-3">
            {t("explore.ctaText", "Don't see what you're looking for?")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate({ to: "/conversations/new" })}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {t("explore.startBlank", "Start a blank conversation")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate({ to: "/agents/new" })}
            >
              <Bot className="h-4 w-4" aria-hidden="true" />
              {t("explore.createAgent", "Create an agent")}
            </Button>
          </div>
        </div>
      </div>

      <TemplateInputDialog
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        template={selectedTemplate}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}
