import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
} from "lucide-react";
import { Button } from "../../components/ui/Button";

export const Route = createFileRoute("/_auth/explore")({
  component: ExplorePage,
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Category = "all" | "general" | "code" | "research" | "creative" | "analysis";

interface SampleConversation {
  id: string;
  title: string;
  description: string;
  category: Exclude<Category, "all">;
  tags: string[];
  starterMessage: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const categories: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Compass },
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
    title: "Explain a Complex Topic",
    description:
      "Get a clear, layered explanation of any topic -- from quantum mechanics to economics.",
    category: "general",
    tags: ["learning", "explanation"],
    starterMessage:
      "Explain how neural networks learn, starting from the basics and building up to backpropagation. Use analogies to make it intuitive.",
    icon: Lightbulb,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    id: "brainstorm-ideas",
    title: "Brainstorm Ideas",
    description:
      "Generate creative ideas for projects, products, or solutions to problems.",
    category: "general",
    tags: ["brainstorm", "ideas"],
    starterMessage:
      "I'm building a productivity app for remote teams. Brainstorm 10 unique features that would differentiate it from Slack and Notion.",
    icon: Sparkles,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    id: "summarize-text",
    title: "Summarize Long Content",
    description:
      "Condense articles, papers, or meeting notes into key takeaways.",
    category: "general",
    tags: ["summary", "writing"],
    starterMessage:
      "Summarize the key arguments and findings from the following text, highlighting any actionable insights:\n\n[Paste your content here]",
    icon: MessageSquare,
    color: "text-success",
    bgColor: "bg-success/10",
  },

  // Code
  {
    id: "code-review",
    title: "Code Review",
    description:
      "Get feedback on code quality, potential bugs, and improvement suggestions.",
    category: "code",
    tags: ["review", "quality"],
    starterMessage:
      "Review this TypeScript function for bugs, performance issues, and best practices. Suggest improvements:\n\n```typescript\n// Paste your code here\n```",
    icon: Code2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    id: "debug-help",
    title: "Debug an Issue",
    description:
      "Describe a bug and get step-by-step debugging guidance and potential fixes.",
    category: "code",
    tags: ["debug", "troubleshoot"],
    starterMessage:
      "I'm getting an unexpected error in my React app. The component re-renders infinitely when I add a useEffect hook. Here's the code:\n\n```tsx\n// Paste your component here\n```",
    icon: Code2,
    color: "text-danger",
    bgColor: "bg-danger/10",
  },
  {
    id: "api-design",
    title: "Design a REST API",
    description:
      "Get help designing API endpoints, schemas, and authentication flows.",
    category: "code",
    tags: ["api", "architecture"],
    starterMessage:
      "Help me design a REST API for a task management system. I need endpoints for projects, tasks, users, and comments. Include authentication, pagination, and error handling patterns.",
    icon: Code2,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },

  // Research
  {
    id: "literature-review",
    title: "Literature Review",
    description:
      "Explore research topics and get structured overviews of existing work.",
    category: "research",
    tags: ["academic", "review"],
    starterMessage:
      "Give me a structured overview of the current state of research on Retrieval-Augmented Generation (RAG). Cover key papers, approaches, limitations, and open problems.",
    icon: Search,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    id: "compare-options",
    title: "Compare Technologies",
    description:
      "Get a balanced comparison of tools, frameworks, or approaches for decision-making.",
    category: "research",
    tags: ["comparison", "decision"],
    starterMessage:
      "Compare PostgreSQL vs. MongoDB for a multi-tenant SaaS application. Consider scalability, schema flexibility, query performance, operational complexity, and cost. Present as a structured comparison.",
    icon: Search,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },

  // Creative
  {
    id: "write-story",
    title: "Write a Short Story",
    description:
      "Collaborate on creative writing with AI as your co-author.",
    category: "creative",
    tags: ["writing", "fiction"],
    starterMessage:
      "Write the opening scene of a sci-fi short story set in 2150 where AI and humans coexist. The main character discovers something unexpected about their AI companion. Make it atmospheric and character-driven.",
    icon: Palette,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    id: "marketing-copy",
    title: "Draft Marketing Copy",
    description:
      "Create compelling copy for landing pages, emails, or social media.",
    category: "creative",
    tags: ["marketing", "copywriting"],
    starterMessage:
      "Write landing page copy for NOVA -- a self-hosted AI platform for teams. Highlight: multi-model support, privacy, custom agents, and knowledge bases. Tone: professional but approachable. Include a headline, subheading, 3 feature sections, and a CTA.",
    icon: Palette,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },

  // Analysis
  {
    id: "data-analysis",
    title: "Analyze Data Patterns",
    description:
      "Upload data and get insights, trends, and visualization suggestions.",
    category: "analysis",
    tags: ["data", "insights"],
    starterMessage:
      "I have the following CSV data showing monthly user signups and churn for the past year. Identify trends, seasonality, and suggest what might be causing the churn spikes:\n\n```csv\nmonth,signups,churned\n// Paste your data here\n```",
    icon: BarChart3,
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    id: "business-analysis",
    title: "SWOT Analysis",
    description:
      "Get a structured strengths, weaknesses, opportunities, threats analysis.",
    category: "analysis",
    tags: ["business", "strategy"],
    starterMessage:
      "Perform a SWOT analysis for a startup entering the self-hosted AI tools market in 2026. Consider the competitive landscape (OpenAI, Anthropic, open-source alternatives), market trends, and enterprise needs.",
    icon: BarChart3,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ConversationCard({
  conversation,
  onStart,
}: {
  conversation: SampleConversation;
  onStart: (starterMessage: string) => void;
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
        onClick={() => onStart(conversation.starterMessage)}
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

  const filteredConversations = useMemo(() => {
    let result = sampleConversations;

    if (activeCategory !== "all") {
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

  const handleStartConversation = (starterMessage: string) => {
    // Store the starter message so the new conversation page can pick it up
    try {
      sessionStorage.setItem("nova:starter-message", starterMessage);
    } catch {
      // sessionStorage unavailable
    }
    navigate({ to: "/conversations/new" });
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
            {t("explore.subtitle", "Discover what NOVA can do. Browse sample conversations and start one with a single click.")}
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("explore.searchPlaceholder", "Search conversations...")}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary focus:outline-2 focus:outline-offset-0 focus:outline-primary focus:border-primary transition-colors"
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

        {/* Grid */}
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
              {t("explore.noResults", "No conversations matching your search")}
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

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-text-tertiary mb-3">
            {t("explore.ctaText", "Don't see what you're looking for?")}
          </p>
          <Button
            variant="primary"
            onClick={() => navigate({ to: "/conversations/new" })}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {t("explore.startBlank", "Start a blank conversation")}
          </Button>
        </div>
      </div>
    </div>
  );
}
