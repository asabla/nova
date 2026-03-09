import { useState, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  Search, Bot, Code2, Palette, BarChart3, Shield, Wrench,
  MessageSquare, Star, Download, ChevronLeft, ChevronRight,
  Sparkles, BookOpen, Globe, Brain, Zap, Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Patterns/AgentMarketplace",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Mock Data ────────────────────────────────────────────────────────────

type Category = "all" | "coding" | "creative" | "analysis" | "research" | "productivity" | "security";

interface MockAgent {
  id: string;
  name: string;
  author: string;
  description: string;
  category: Exclude<Category, "all">;
  icon: typeof Bot;
  iconColor: string;
  iconBg: string;
  rating: number;
  downloads: number;
  tags: string[];
  featured?: boolean;
}

const agents: MockAgent[] = [
  { id: "1", name: "Code Reviewer", author: "nova-team", description: "Analyzes code for bugs, security issues, and style improvements. Supports 15+ languages.", category: "coding", icon: Code2, iconColor: "text-orange-500", iconBg: "bg-orange-500/10", rating: 4.8, downloads: 12400, tags: ["code", "review", "security"], featured: true },
  { id: "2", name: "Data Analyst", author: "analytics-lab", description: "Transforms raw data into insights. Generates charts, statistics, and executive summaries.", category: "analysis", icon: BarChart3, iconColor: "text-blue-500", iconBg: "bg-blue-500/10", rating: 4.7, downloads: 8900, tags: ["data", "charts", "statistics"], featured: true },
  { id: "3", name: "Creative Writer", author: "nova-team", description: "Crafts stories, marketing copy, blog posts, and creative content with your brand voice.", category: "creative", icon: Palette, iconColor: "text-purple-500", iconBg: "bg-purple-500/10", rating: 4.5, downloads: 6200, tags: ["writing", "marketing", "content"] },
  { id: "4", name: "Research Assistant", author: "sci-tools", description: "Searches papers, summarizes findings, and generates literature reviews with citations.", category: "research", icon: BookOpen, iconColor: "text-green-500", iconBg: "bg-green-500/10", rating: 4.9, downloads: 15600, tags: ["research", "papers", "citations"], featured: true },
  { id: "5", name: "Security Auditor", author: "sec-ops", description: "Scans configurations, analyzes threat models, and generates security reports.", category: "security", icon: Shield, iconColor: "text-red-500", iconBg: "bg-red-500/10", rating: 4.6, downloads: 4300, tags: ["security", "audit", "compliance"] },
  { id: "6", name: "API Builder", author: "dev-studio", description: "Designs REST/GraphQL APIs, generates OpenAPI specs, and creates mock servers.", category: "coding", icon: Wrench, iconColor: "text-teal-500", iconBg: "bg-teal-500/10", rating: 4.4, downloads: 3800, tags: ["api", "openapi", "backend"] },
  { id: "7", name: "Meeting Summarizer", author: "nova-team", description: "Converts meeting transcripts into structured notes, action items, and follow-ups.", category: "productivity", icon: MessageSquare, iconColor: "text-indigo-500", iconBg: "bg-indigo-500/10", rating: 4.3, downloads: 9100, tags: ["meetings", "notes", "productivity"] },
  { id: "8", name: "Language Tutor", author: "edu-hub", description: "Interactive language learning with conversation practice, grammar drills, and vocab building.", category: "creative", icon: Globe, iconColor: "text-cyan-500", iconBg: "bg-cyan-500/10", rating: 4.7, downloads: 7500, tags: ["language", "education", "practice"] },
  { id: "9", name: "Reasoning Engine", author: "ai-labs", description: "Step-by-step logical reasoning for complex problems, math proofs, and decision analysis.", category: "analysis", icon: Brain, iconColor: "text-amber-500", iconBg: "bg-amber-500/10", rating: 4.8, downloads: 5200, tags: ["reasoning", "logic", "math"] },
  { id: "10", name: "Workflow Automator", author: "nova-team", description: "Creates automation scripts, cron jobs, and CI/CD pipelines from natural language.", category: "productivity", icon: Zap, iconColor: "text-yellow-500", iconBg: "bg-yellow-500/10", rating: 4.5, downloads: 6800, tags: ["automation", "ci-cd", "devops"] },
  { id: "11", name: "UX Reviewer", author: "design-co", description: "Analyzes UI screenshots, suggests improvements, and generates accessibility reports.", category: "creative", icon: Sparkles, iconColor: "text-pink-500", iconBg: "bg-pink-500/10", rating: 4.2, downloads: 2100, tags: ["ux", "design", "a11y"] },
  { id: "12", name: "Paper Researcher", author: "sci-tools", description: "Deep-dives into academic topics with structured arguments and source verification.", category: "research", icon: BookOpen, iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10", rating: 4.6, downloads: 3400, tags: ["academic", "research", "writing"] },
];

const categories: { id: Category; label: string; icon: typeof Bot }[] = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "coding", label: "Coding", icon: Code2 },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "productivity", label: "Productivity", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
];

function formatDownloads(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// ── Agent Card ───────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: MockAgent }) {
  const Icon = agent.icon;
  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-all cursor-pointer group">
      <div className="flex items-start gap-3 mb-3">
        <div className={clsx("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", agent.iconBg)}>
          <Icon className={clsx("h-5 w-5", agent.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text truncate">{agent.name}</h3>
            {agent.featured && <Badge variant="primary">Featured</Badge>}
          </div>
          <p className="text-[10px] text-text-tertiary">by {agent.author}</p>
        </div>
      </div>

      <p className="text-xs text-text-secondary mb-3 line-clamp-2">{agent.description}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {agent.tags.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-tertiary text-text-tertiary"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-warning fill-warning" />
          <span className="text-[11px] font-medium text-text">{agent.rating}</span>
        </div>
        <div className="flex items-center gap-1">
          <Download className="h-3 w-3 text-text-tertiary" />
          <span className="text-[11px] text-text-tertiary">{formatDownloads(agent.downloads)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Install
        </Button>
      </div>
    </div>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Full marketplace with search, filters, and pagination */
export const Default: Story = {
  render: () => {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<Category>("all");
    const [page, setPage] = useState(1);
    const perPage = 6;

    const filtered = useMemo(() => {
      return agents.filter((a) => {
        if (category !== "all" && a.category !== category) return false;
        if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.tags.some((t) => t.includes(search.toLowerCase()))) return false;
        return true;
      });
    }, [search, category]);

    const totalPages = Math.ceil(filtered.length / perPage);
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);

    return (
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-text">Agent Marketplace</h1>
            <p className="text-sm text-text-secondary mt-1">
              Discover and install specialized agents for your workflows
            </p>
          </div>
          <Button variant="secondary">
            <Bot className="h-4 w-4 mr-1.5" />
            My Agents
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm input-glow rounded-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
            />
          </div>
          <div className="flex gap-1">
            {categories.map((cat) => {
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setCategory(cat.id); setPage(1); }}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    category === cat.id
                      ? "bg-primary/10 text-primary"
                      : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
                  )}
                >
                  <CatIcon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <p className="text-xs text-text-tertiary mb-3">
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""} found
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {paginated.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-border text-text-tertiary hover:text-text disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={clsx(
                  "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
                  p === page ? "bg-primary text-white" : "text-text-secondary hover:bg-surface-tertiary",
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-border text-text-tertiary hover:text-text disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  },
};

/** Featured agents spotlight */
export const FeaturedAgents: Story = {
  render: () => {
    const featured = agents.filter((a) => a.featured);
    return (
      <div className="max-w-5xl">
        <h2 className="text-lg font-semibold text-text mb-1">Featured Agents</h2>
        <p className="text-sm text-text-secondary mb-4">Hand-picked agents by the NOVA team</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featured.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    );
  },
};

/** Agent detail card (expanded view) */
export const AgentDetail: Story = {
  render: () => {
    const agent = agents[0]!;
    const Icon = agent.icon;
    return (
      <div className="max-w-lg">
        <div className="rounded-xl border border-border bg-surface-secondary p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={clsx("h-14 w-14 rounded-xl flex items-center justify-center", agent.iconBg)}>
              <Icon className={clsx("h-7 w-7", agent.iconColor)} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text">{agent.name}</h2>
              <p className="text-xs text-text-tertiary">by {agent.author}</p>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                  <span className="text-xs font-medium text-text">{agent.rating}</span>
                </div>
                <span className="text-xs text-text-tertiary">{formatDownloads(agent.downloads)} installs</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-text-secondary mb-4">{agent.description}</p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {agent.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1">
              <Download className="h-4 w-4 mr-1.5" />
              Install Agent
            </Button>
            <Button variant="ghost">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  },
};
