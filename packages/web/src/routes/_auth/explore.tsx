import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  MessageSquare,
  Code2,
  Search,
  Lightbulb,
  Palette,
  BarChart3,
  ArrowRight,
  Sparkles,
  Bot,
  Star,
  FileText,
  BookOpen,
  Mail,
  PenTool,
  Database,
  Terminal,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { TemplateInputDialog } from "../../components/explore/TemplateInputDialog";
import { api } from "../../lib/api";
import { setPendingFiles } from "../../lib/pending-files";
import { getAgentColor, getAgentBgStyle, getAgentIconStyle } from "../../lib/agent-appearance";

export const Route = createFileRoute("/_auth/explore")({
  component: ExplorePage,
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Category = "all" | "agents" | "general" | "code" | "research" | "creative" | "analysis";

type TemplateInputType = "text" | "textarea" | "file";

export interface TemplateInput {
  id: string;
  type: TemplateInputType;
  label: string;
  placeholder: string;
  required: boolean;
  accept?: string;
}

export interface SampleConversation {
  id: string;
  title: string;
  description: string;
  category: Exclude<Category, "all" | "agents">;
  tags: string[];
  starterMessage: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  inputs?: TemplateInput[];
}

const categories: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Compass },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "general", label: "General", icon: MessageSquare },
  { id: "code", label: "Code", icon: Code2 },
  { id: "research", label: "Research", icon: Search },
  { id: "creative", label: "Creative", icon: Palette },
  { id: "analysis", label: "Analysis", icon: BarChart3 },
];

const sampleConversations: SampleConversation[] = [
  // General
  {
    id: "explain-concept",
    title: "Explain a Technical Concept",
    description:
      "Get a layered explanation that builds from fundamentals to advanced details, with real-world analogies.",
    category: "general",
    tags: ["learning", "explanation"],
    starterMessage:
      "Explain {{topic}} in a layered way. Start with the high-level intuition, then go deeper into how it actually works under the hood. Use real-world analogies where they help.",
    icon: Lightbulb,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "topic",
        type: "text",
        label: "What topic do you want explained?",
        placeholder: "e.g. how TLS/SSL encryption works, how garbage collection works, how DNS resolution works...",
        required: true,
      },
    ],
  },
  {
    id: "meeting-summary",
    title: "Extract Action Items from Notes",
    description:
      "Turn messy meeting notes or a brain dump into structured decisions, action items, and next steps.",
    category: "general",
    tags: ["productivity", "summary"],
    starterMessage:
      "Extract decisions, action items (with owners if mentioned), and open questions from these meeting notes. Flag anything that seems unresolved or contradictory.\n\n{{notes}}",
    icon: FileText,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "notes",
        type: "textarea",
        label: "Meeting notes or transcript",
        placeholder: "Paste your raw meeting notes, transcript, or brain dump here...",
        required: true,
      },
      {
        id: "notes_file",
        type: "file",
        label: "Or upload a document",
        placeholder: "TXT, MD, DOCX, PDF...",
        required: false,
        accept: ".txt,.md,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",
      },
    ],
  },
  {
    id: "brainstorm-solutions",
    title: "Brainstorm Solutions",
    description:
      "Generate diverse ideas for a specific problem, with trade-offs for each approach.",
    category: "general",
    tags: ["brainstorm", "ideas"],
    starterMessage:
      "I need help brainstorming solutions for the following problem:\n\n{{problem}}\n\nGive me 8 concrete approaches ranked by impact-to-effort ratio, with trade-offs for each.",
    icon: Sparkles,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "problem",
        type: "textarea",
        label: "What problem do you need solutions for?",
        placeholder: "e.g. Our CI/CD pipeline takes 45 minutes and we need it under 15, our onboarding flow has a 60% drop-off rate, we're running out of database storage...",
        required: true,
      },
    ],
  },

  // Code
  {
    id: "code-review",
    title: "Code Review",
    description:
      "Get a thorough review covering bugs, security, performance, and maintainability.",
    category: "code",
    tags: ["review", "quality"],
    starterMessage:
      "Review this code for bugs, security issues, performance problems, and readability. Prioritize findings by severity and provide a corrected version for anything critical.\n\n```\n{{code}}\n```",
    icon: Code2,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "code",
        type: "textarea",
        label: "Code to review",
        placeholder: "Paste your code here...",
        required: true,
      },
      {
        id: "code_file",
        type: "file",
        label: "Or upload a source file",
        placeholder: ".ts, .py, .go, .rs, .java, ...",
        required: false,
        accept: "text/*,application/json,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.rb,.php,.swift,.kt",
      },
    ],
  },
  {
    id: "debug-error",
    title: "Debug an Error",
    description:
      "Paste an error message or describe unexpected behavior and get a root cause analysis with fix.",
    category: "code",
    tags: ["debug", "troubleshoot"],
    starterMessage:
      "I'm getting this error and I can't figure out the root cause. Walk me through what's happening, why it's failing, and how to fix it.\n\nError:\n```\n{{error}}\n```\n\nRelevant code (if applicable):\n```\n{{context_code}}\n```",
    icon: Terminal,
    color: "text-danger",
    bgColor: "bg-danger/10",
    inputs: [
      {
        id: "error",
        type: "textarea",
        label: "Error message or stack trace",
        placeholder: "Paste the full error message or stack trace...",
        required: true,
      },
      {
        id: "context_code",
        type: "textarea",
        label: "Relevant code (optional)",
        placeholder: "Paste the code that's causing the error...",
        required: false,
      },
    ],
  },
  {
    id: "system-design",
    title: "System Design",
    description:
      "Get a technical architecture with component diagrams, data flow, and technology choices.",
    category: "code",
    tags: ["architecture", "design"],
    starterMessage:
      "Design a system for the following:\n\n{{system}}\n\nCover the architecture, data model, technology choices, and how it scales.",
    icon: Database,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "system",
        type: "textarea",
        label: "What system do you want designed?",
        placeholder: "e.g. A real-time notification system for a SaaS app with 100k daily active users, supporting push notifications, in-app, and email digests...",
        required: true,
      },
    ],
  },
  {
    id: "write-script",
    title: "Write a Script",
    description:
      "Describe what you need automated and get a working, well-documented script.",
    category: "code",
    tags: ["automation", "script"],
    starterMessage:
      "Write a script for the following:\n\n{{task}}\n\nInclude logging, error handling, and clear comments. Make it production-ready.",
    icon: Terminal,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "task",
        type: "textarea",
        label: "What do you need the script to do?",
        placeholder: "e.g. Monitor a directory for new CSV files, validate their schema, clean the data, and load them into a SQLite database...",
        required: true,
      },
    ],
  },

  // Research
  {
    id: "compare-options",
    title: "Compare Technologies",
    description:
      "Get a structured side-by-side comparison of tools, frameworks, or approaches to make a decision.",
    category: "research",
    tags: ["comparison", "decision"],
    starterMessage:
      "Help me compare the following:\n\n{{comparison}}\n\nEvaluate key dimensions like performance, developer experience, ecosystem maturity, cost, and long-term maintainability. Present as a comparison matrix and recommend one with clear reasoning.",
    icon: Search,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "comparison",
        type: "textarea",
        label: "What do you want to compare?",
        placeholder: "e.g. React Native vs Flutter vs native Swift/Kotlin for a mobile app. Our team knows TypeScript well. We need offline support and push notifications...",
        required: true,
      },
    ],
  },
  {
    id: "research-topic",
    title: "Research a Topic",
    description:
      "Get a structured overview of a subject with key concepts, current state, and open questions.",
    category: "research",
    tags: ["learning", "overview"],
    starterMessage:
      "Give me a structured overview of {{topic}}. Cover: what it is and how it works, the current state of the art, major tools or projects in the space, real-world production use cases, limitations and gotchas, and where things are headed in the next 1-2 years.",
    icon: BookOpen,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "topic",
        type: "text",
        label: "What topic do you want researched?",
        placeholder: "e.g. WebAssembly for server-side use, edge computing architectures, vector databases...",
        required: true,
      },
    ],
  },

  // Creative
  {
    id: "draft-email",
    title: "Draft a Professional Email",
    description:
      "Get a polished, ready-to-send email for any professional situation.",
    category: "creative",
    tags: ["email", "writing"],
    starterMessage:
      "Draft a professional email based on the following:\n\n{{context}}\n\nMake it clear, concise, and professional. Keep it under 300 words.",
    icon: Mail,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "context",
        type: "textarea",
        label: "What's the email about?",
        placeholder: "e.g. Announce to the engineering team that we're migrating from REST to GraphQL. Tone: direct but encouraging. Include timeline and a clear ask to review the RFC by Friday...",
        required: true,
      },
    ],
  },
  {
    id: "write-proposal",
    title: "Write a Proposal or Brief",
    description:
      "Create a structured document that argues for a specific project, initiative, or approach.",
    category: "creative",
    tags: ["writing", "business"],
    starterMessage:
      "Write a one-page proposal for the following:\n\n{{proposal}}\n\nCover the problem, proposed solution, estimated effort, expected ROI, and recommended next steps.",
    icon: PenTool,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "proposal",
        type: "textarea",
        label: "What should the proposal argue for?",
        placeholder: "e.g. Adopting a design system at our 40-person startup. We have 3 frontend apps with inconsistent UI. We want to propose a component library + design tokens + Storybook...",
        required: true,
      },
    ],
  },

  // Analysis
  {
    id: "analyze-data",
    title: "Analyze a Dataset",
    description:
      "Upload data and get a full analysis with insights, trends, and visualizations.",
    category: "analysis",
    tags: ["data", "insights"],
    starterMessage:
      "Analyze this dataset. Start with a data quality assessment, then identify the most important patterns and trends. Create visualizations for the key findings. End with 3 actionable recommendations.\n\n```\n{{data}}\n```",
    icon: BarChart3,
    color: "text-success",
    bgColor: "bg-success/10",
    inputs: [
      {
        id: "data",
        type: "textarea",
        label: "Paste your data (CSV, JSON, or table)",
        placeholder: "date,revenue,customers,churn_rate\n2025-01,120000,450,3.2\n2025-02,135000,480,2.8\n...",
        required: true,
      },
      {
        id: "data_file",
        type: "file",
        label: "Or upload a data file",
        placeholder: ".csv, .xlsx, .json, .tsv",
        required: false,
        accept: ".csv,.xlsx,.xls,.json,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json",
      },
    ],
  },
  {
    id: "sql-query",
    title: "Write a SQL Query",
    description:
      "Describe what you need in plain English and get a performant, well-commented SQL query.",
    category: "analysis",
    tags: ["sql", "database"],
    starterMessage:
      "Write a PostgreSQL query for the following:\n\n{{request}}\n\nDatabase schema:\n```sql\n{{schema}}\n```\n\nUse CTEs for readability, add comments explaining the logic, and note any performance considerations.",
    icon: Database,
    color: "text-primary",
    bgColor: "bg-primary/10",
    inputs: [
      {
        id: "request",
        type: "textarea",
        label: "What should the query do?",
        placeholder: "e.g. Find all customers who made at least 3 purchases in the last 90 days but haven't logged in during the last 14 days...",
        required: true,
      },
      {
        id: "schema",
        type: "textarea",
        label: "Database schema (table definitions)",
        placeholder: "customers(id, email, name, created_at)\norders(id, customer_id, total, created_at)\nsessions(id, customer_id, started_at)",
        required: true,
      },
    ],
  },
  {
    id: "strategic-analysis",
    title: "Strategic Analysis",
    description:
      "Get a structured competitive analysis, SWOT, or market assessment for a business question.",
    category: "analysis",
    tags: ["business", "strategy"],
    starterMessage:
      "Perform a strategic analysis for the following:\n\n{{question}}\n\nInclude a comparison matrix, key insights, and actionable recommendations.",
    icon: BarChart3,
    color: "text-warning",
    bgColor: "bg-warning/10",
    inputs: [
      {
        id: "question",
        type: "textarea",
        label: "What business question or market do you want analyzed?",
        placeholder: "e.g. Competitive analysis of the self-hosted AI platform market — compare open-source, commercial self-hosted, and cloud-managed options for a 50-person team...",
        required: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  onChat,
  onView,
}: {
  agent: any;
  onChat: (agent: any) => void;
  onView: (agent: any) => void;
}) {
  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={getAgentBgStyle(getAgentColor(agent))}>
          <Bot className="h-5 w-5" style={getAgentIconStyle(getAgentColor(agent))} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text truncate">{agent.name}</h3>
          {agent.visibility && (
            <Badge variant={agent.visibility === "public" ? "primary" : "default"} className="mt-0.5">
              {agent.visibility}
            </Badge>
          )}
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
        <button
          onClick={() => onView(agent)}
          className="text-xs text-text-tertiary hover:text-text transition-colors"
        >
          View
        </button>
        <Button variant="ghost" size="sm" onClick={() => onChat(agent)}>
          <MessageSquare className="h-3 w-3 mr-1" aria-hidden="true" />
          Chat
        </Button>
      </div>
    </div>
  );
}

function ConversationCard({
  conversation,
  onStart,
}: {
  conversation: SampleConversation;
  onStart: (conversation: SampleConversation) => void;
}) {
  const { t } = useTranslation();
  const Icon = conversation.icon;

  return (
    <div className="flex flex-col p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 rounded-xl ${conversation.bgColor} flex items-center justify-center`}
        >
          <Icon className={`h-5 w-5 ${conversation.color}`} aria-hidden="true" />
        </div>
        <div className="flex gap-1">
          {conversation.tags.map((tag) => (
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
        {conversation.title}
      </h3>
      <p className="text-xs text-text-tertiary leading-relaxed mb-4 flex-1">
        {conversation.description}
      </p>

      <button
        onClick={() => onStart(conversation)}
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
  const [selectedTemplate, setSelectedTemplate] = useState<SampleConversation | null>(null);

  // Fetch published agents
  const { data: agentsData } = useQuery({
    queryKey: ["agents-marketplace", "explore"],
    queryFn: () => api.get<any>("/api/agents/marketplace/browse"),
    staleTime: 60_000,
  });

  const publishedAgents: any[] = (agentsData as any)?.data ?? [];

  const filteredConversations = useMemo(() => {
    let result = sampleConversations;

    if (activeCategory !== "all" && activeCategory !== "agents") {
      result = result.filter((c) => c.category === activeCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [activeCategory, searchQuery]);

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

  const handleStartConversation = (conversation: SampleConversation) => {
    if (conversation.inputs?.length) {
      setSelectedTemplate(conversation);
      return;
    }
    try {
      sessionStorage.setItem("nova:starter-message", conversation.starterMessage);
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

  const handleViewAgent = (agent: any) => {
    navigate({ to: `/agents/${agent.id}` });
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
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
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
                  onView={handleViewAgent}
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

            {filteredConversations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
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
        conversation={selectedTemplate}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}
