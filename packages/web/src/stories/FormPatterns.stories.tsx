import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Sparkles,
  Eye,
  Search,
  Upload,
  ChevronDown,
  Globe,
  Code,
  FileText,
  Database,
  Terminal,
  Brain,
  Zap,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";

const meta: Meta = {
  title: "Patterns/Forms",
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════════════════════
   1. LOGIN FORM
   ═══════════════════════════════════════════════════════════════════════════ */

function LoginFormDemo() {
  return (
    <div className="w-[400px]">
      <div className="rounded-2xl bg-surface border border-border shadow-xl overflow-hidden">
        {/* Header with logo */}
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary mb-4">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-text tracking-tight">Welcome back</h1>
          <p className="text-sm text-text-secondary mt-1">Sign in to your NOVA account</p>
        </div>

        {/* Form */}
        <div className="px-8 pb-8 space-y-5">
          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface-secondary text-sm font-medium text-text hover:bg-surface-tertiary transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 h-10 rounded-lg border border-border bg-surface-secondary text-sm font-medium text-text hover:bg-surface-tertiary transition-colors">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
                or continue with email
              </span>
            </div>
          </div>

          {/* Email & Password */}
          <Input label="Email" type="email" placeholder="you@company.com" />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text">Password</label>
              <button className="text-xs text-primary hover:text-primary-dark transition-colors font-medium">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter password"
                defaultValue="mysecretpassword"
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 pr-10 text-sm text-text placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary focus-visible:border-primary transition-colors hover:border-border-strong"
              />
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text transition-colors rounded">
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div className="relative h-4 w-4 rounded border border-border-strong bg-surface group-hover:border-primary transition-colors">
              <svg className="absolute inset-0 h-4 w-4 text-primary opacity-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-text-secondary">Remember me for 30 days</span>
          </label>

          {/* Sign In */}
          <Button className="w-full">Sign In</Button>

          {/* Create account */}
          <p className="text-center text-sm text-text-secondary">
            Don't have an account?{" "}
            <button className="text-primary hover:text-primary-dark font-medium transition-colors">
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export const LoginForm: Story = {
  name: "Login Form",
  render: () => <LoginFormDemo />,
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. CREATE AGENT FORM
   ═══════════════════════════════════════════════════════════════════════════ */

function ModelCard({
  name,
  provider,
  desc,
  selected = false,
}: {
  name: string;
  provider: string;
  desc: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-border-strong bg-surface-secondary"
      }`}
    >
      {/* Radio indicator */}
      <div className="absolute top-3.5 right-3.5">
        <div
          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? "border-primary" : "border-border-strong"
          }`}
        >
          {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
      </div>

      <p className="text-sm font-semibold text-text">{name}</p>
      <p className="text-[10px] text-text-tertiary mt-0.5">{provider}</p>
      <p className="text-xs text-text-secondary mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}

function ToolToggle({ name, icon: Icon, enabled = false }: { name: string; icon: React.ComponentType<{ className?: string }>; enabled?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-surface-tertiary flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-text-secondary" />
        </div>
        <span className="text-sm text-text">{name}</span>
      </div>
      <div className={`h-5 w-9 rounded-full relative cursor-pointer transition-colors ${enabled ? "bg-primary" : "bg-border-strong"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
      </div>
    </div>
  );
}

function CreateAgentFormDemo() {
  return (
    <div className="w-[560px] space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text">Create New Agent</h2>
        <p className="text-sm text-text-secondary mt-1">Configure a specialized AI agent for your team.</p>
      </div>

      {/* Basic Info */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Basic Information</h3>
        </div>
        <Input label="Agent Name" placeholder="e.g., Research Analyst" />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text">Description</label>
          <div className="min-h-[80px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-tertiary hover:border-border-strong transition-colors cursor-text">
            Describe what this agent does and how it should behave...
          </div>
        </div>
      </section>

      {/* Model Selection */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Model</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ModelCard
            name="GPT-4o"
            provider="OpenAI"
            desc="Best for general tasks, fast and capable."
            selected
          />
          <ModelCard
            name="Claude Opus 4"
            provider="Anthropic"
            desc="Deep reasoning and long-form analysis."
          />
          <ModelCard
            name="Llama 3.1 70B"
            provider="Meta · Self-hosted"
            desc="Open model, full data privacy."
          />
        </div>
      </section>

      {/* System Prompt */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">System Prompt</h3>
        </div>
        <div className="min-h-[120px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text font-mono leading-relaxed hover:border-border-strong transition-colors cursor-text">
          <span className="text-text-secondary">You are a research analyst agent. Your task is to:</span>
          <br />
          <span className="text-text-secondary">1. Search the web for relevant sources</span>
          <br />
          <span className="text-text-secondary">2. Analyze and cross-reference findings</span>
          <br />
          <span className="text-text-secondary">3. Produce a structured report with citations</span>
        </div>
        <p className="text-[10px] text-text-tertiary">Supports Markdown. Use variables like {"{{user_name}}"} for dynamic content.</p>
      </section>

      {/* Parameters */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Parameters</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text">Temperature</label>
              <span className="text-xs font-mono text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded">0.7</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-surface-tertiary">
              <div className="absolute h-1.5 rounded-full bg-primary" style={{ width: "70%" }} />
              <div className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-primary-foreground shadow-sm" style={{ left: "calc(70% - 8px)" }} />
            </div>
            <div className="flex justify-between text-[10px] text-text-tertiary">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
          <Input label="Max Tokens" type="number" placeholder="4096" defaultValue="4096" />
        </div>
      </section>

      {/* Knowledge Base */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Knowledge Base</h3>
        </div>
        <div className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border bg-surface-secondary/50 hover:border-primary/40 hover:bg-primary/3 transition-colors cursor-pointer group">
          <div className="h-10 w-10 rounded-xl bg-surface-tertiary flex items-center justify-center mb-2 group-hover:bg-primary/10 transition-colors">
            <Upload className="h-5 w-5 text-text-tertiary group-hover:text-primary transition-colors" />
          </div>
          <p className="text-sm font-medium text-text-secondary">Drop files here or click to upload</p>
          <p className="text-[10px] text-text-tertiary mt-1">PDF, TXT, MD, CSV — up to 50MB each</p>
        </div>
      </section>

      {/* Tools */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Tools</h3>
        </div>
        <div className="divide-y divide-border/50">
          <ToolToggle name="Web Search" icon={Globe} enabled />
          <ToolToggle name="Code Execution" icon={Terminal} enabled />
          <ToolToggle name="File Analysis" icon={FileText} />
          <ToolToggle name="Database Query" icon={Database} />
          <ToolToggle name="API Requests" icon={Code} />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button variant="ghost">Cancel</Button>
        <Button>
          <Brain className="h-4 w-4" /> Create Agent
        </Button>
      </div>
    </div>
  );
}

export const CreateAgentForm: Story = {
  name: "Create Agent Form",
  render: () => <CreateAgentFormDemo />,
  parameters: { layout: "padded" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. SEARCH WITH FILTERS
   ═══════════════════════════════════════════════════════════════════════════ */

function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? "bg-primary/10 text-primary border border-primary/20"
          : "bg-surface-tertiary text-text-secondary border border-transparent hover:bg-surface-tertiary hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function SearchWithFiltersDemo() {
  return (
    <div className="w-[640px] space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search conversations, agents, knowledge..."
          defaultValue="vector database"
          className="w-full h-10 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary focus-visible:border-primary transition-colors"
        />
      </div>

      {/* Filters Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterChip label="All" active />
            <FilterChip label="Conversations" />
            <FilterChip label="Agents" />
            <FilterChip label="Knowledge" />
            <FilterChip label="Files" />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-text-tertiary">24 results</span>
          <button className="flex items-center gap-1 text-xs text-text-secondary hover:text-text transition-colors font-medium">
            <ArrowUpDown className="h-3 w-3" />
            Relevance
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Results Preview */}
      <div className="space-y-2 pt-2">
        {[
          {
            title: "pgvector vs Pinecone comparison",
            type: "Conversation",
            snippet: "...comparing vector database solutions for our RAG pipeline. pgvector offers...",
            time: "2 days ago",
            badge: "primary" as const,
          },
          {
            title: "Vector Search Implementation Guide",
            type: "Knowledge",
            snippet: "...comprehensive guide to implementing vector similarity search with PostgreSQL...",
            time: "1 week ago",
            badge: "success" as const,
          },
          {
            title: "Database Optimization Agent",
            type: "Agent",
            snippet: "Specialized in PostgreSQL performance tuning and vector index optimization.",
            time: "Created Jan 2026",
            badge: "warning" as const,
          },
        ].map((result) => (
          <div
            key={result.title}
            className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-surface-secondary hover:border-border-strong transition-all cursor-pointer group"
          >
            <div className="mt-0.5">
              <Badge variant={result.badge}>{result.type}</Badge>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text group-hover:text-primary transition-colors truncate">
                {result.title}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{result.snippet}</p>
            </div>
            <span className="text-[10px] text-text-tertiary shrink-0 mt-0.5">{result.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SearchWithFilters: Story = {
  name: "Search with Filters",
  render: () => <SearchWithFiltersDemo />,
  parameters: { layout: "padded" },
};
