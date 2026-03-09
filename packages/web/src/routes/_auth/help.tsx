import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  HelpCircle,
  Search,
  MessageSquare,
  Bot,
  BookOpen,
  Users,
  Settings,
  Rocket,
  ChevronDown,
  ChevronRight,
  Keyboard,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_auth/help")({
  component: HelpPage,
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface HelpSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  articles: { title: string; body: string }[];
}

const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    color: "text-primary",
    articles: [
      {
        title: "Creating your first conversation",
        body: "Click the \"+\" button in the sidebar or press Cmd+N to start a new conversation. Choose a model from the dropdown, type your message, and press Enter to send. The AI will respond in real-time with streaming output.",
      },
      {
        title: "Choosing a model",
        body: "NOVA supports multiple AI providers and models. Use the model selector at the top of a conversation to switch between them. Each model has different strengths -- some are faster, some are better at reasoning or creative tasks.",
      },
      {
        title: "Navigating the interface",
        body: "The sidebar on the left shows your conversations, agents, and knowledge bases. Use the command palette (Cmd+K) to quickly jump anywhere. Your settings are accessible from the bottom-left user menu.",
      },
    ],
  },
  {
    id: "conversations",
    title: "Conversations",
    icon: MessageSquare,
    color: "text-success",
    articles: [
      {
        title: "Sending messages",
        body: "Type your message in the input area at the bottom and press Enter to send. Use Shift+Enter for line breaks. You can attach files by dragging them into the chat or clicking the paperclip icon.",
      },
      {
        title: "System prompts",
        body: "Set a system prompt to guide the AI's behavior for the entire conversation. Open conversation settings via the gear icon to configure the system prompt, temperature, and other parameters.",
      },
      {
        title: "Branching conversations",
        body: "Click on any message to create a branch -- an alternate path in the conversation. This lets you explore different responses without losing your original thread.",
      },
      {
        title: "Exporting conversations",
        body: "Open the conversation menu (three dots icon) to export as Markdown or JSON. You can also share conversations with teammates within your workspace.",
      },
    ],
  },
  {
    id: "agents",
    title: "Agents",
    icon: Bot,
    color: "text-warning",
    articles: [
      {
        title: "What are agents?",
        body: "Agents are custom AI assistants configured with specific instructions, tools, and knowledge bases. They let you create purpose-built assistants for tasks like code review, research, writing, and more.",
      },
      {
        title: "Creating an agent",
        body: "Go to the Agents page and click \"New Agent\". Give it a name, write system instructions, select a model, and optionally attach tools and knowledge bases. You can test it immediately in a conversation.",
      },
      {
        title: "Sharing agents",
        body: "Agents can be shared within your workspace so your whole team can use them. Set the visibility to \"workspace\" when creating or editing an agent.",
      },
    ],
  },
  {
    id: "knowledge",
    title: "Knowledge",
    icon: BookOpen,
    color: "text-primary",
    articles: [
      {
        title: "Building a knowledge base",
        body: "Navigate to the Knowledge page and create a new collection. Upload documents (PDF, Markdown, text, code) that will be chunked, embedded, and made searchable for your agents.",
      },
      {
        title: "Supported file formats",
        body: "NOVA supports PDF, Markdown, plain text, HTML, CSV, JSON, and common code file formats. Large files are automatically split into searchable chunks with overlap for context preservation.",
      },
      {
        title: "Connecting knowledge to agents",
        body: "When creating or editing an agent, select one or more knowledge bases in the configuration. The agent will automatically search relevant documents to provide grounded answers.",
      },
    ],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    icon: Users,
    color: "text-success",
    articles: [
      {
        title: "What are workspaces?",
        body: "Workspaces are shared spaces where team members can collaborate. Each workspace has its own conversations, agents, knowledge bases, and permissions.",
      },
      {
        title: "Inviting members",
        body: "Workspace admins can invite members by email. Navigate to the workspace settings to manage members, roles, and permissions.",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    color: "text-text-secondary",
    articles: [
      {
        title: "Profile settings",
        body: "Update your display name, avatar, and email from Settings > Profile. You can also manage your API keys for programmatic access.",
      },
      {
        title: "Appearance",
        body: "Switch between light, dark, and system themes in Settings > Appearance. NOVA will follow your system preference by default.",
      },
      {
        title: "Notifications",
        body: "Configure which notifications you receive and how in Settings > Notifications. You can set preferences per workspace.",
      },
    ],
  },
];

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: "How do I switch between AI models?",
    answer:
      "Use the model selector dropdown at the top of any conversation. You can change models mid-conversation -- the new model will be used for subsequent messages.",
  },
  {
    question: "Can I use NOVA offline?",
    answer:
      "NOVA requires a connection to your self-hosted server, but the server itself can run entirely on your local network without internet access if you configure local AI models.",
  },
  {
    question: "How is my data stored?",
    answer:
      "All data is stored in your PostgreSQL database on your own infrastructure. Files are stored in MinIO (S3-compatible). Nothing is sent to external services unless you configure external AI providers.",
  },
  {
    question: "What AI providers are supported?",
    answer:
      "NOVA supports OpenAI, Anthropic, Google, Mistral, Ollama, and any OpenAI-compatible API through LiteLLM. Your admin configures available models in the admin panel.",
  },
  {
    question: "How do I reset the onboarding tutorial?",
    answer:
      "Go to Settings > Profile and click \"Reset onboarding\" at the bottom of the page. The tutorial will show again on your next visit.",
  },
  {
    question: "Can I use slash commands?",
    answer:
      "Yes! Type \"/\" in the message input to see available slash commands. Commands include /model to switch models, /agent to select an agent, /clear to reset context, and more.",
  },
];

interface ShortcutDef {
  keys: string;
  label: string;
  category: string;
}

function getModKey(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? navigator.userAgent)) {
    return "Cmd";
  }
  return "Ctrl";
}

function buildShortcuts(): ShortcutDef[] {
  const mod = getModKey();
  return [
    { keys: `${mod}+K`, label: "Open command palette", category: "Navigation" },
    { keys: `${mod}+N`, label: "New conversation", category: "Navigation" },
    { keys: `${mod}+/`, label: "Focus message input", category: "Navigation" },
    { keys: `${mod}+?`, label: "Show keyboard shortcuts", category: "Navigation" },
    { keys: `${mod}+,`, label: "Open settings", category: "Navigation" },
    { keys: "Enter", label: "Send message", category: "Chat" },
    { keys: "Shift+Enter", label: "New line in message", category: "Chat" },
    { keys: "Escape", label: "Close modal / cancel", category: "General" },
    { keys: `${mod}+Shift+S`, label: "Toggle sidebar", category: "General" },
  ];
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function SectionCard({
  section,
  searchQuery,
}: {
  section: HelpSection;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = section.icon;

  const filteredArticles = useMemo(() => {
    if (!searchQuery) return section.articles;
    const q = searchQuery.toLowerCase();
    return section.articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [section.articles, searchQuery]);

  // Auto-expand when search matches
  const isExpanded = expanded || (searchQuery.length > 0 && filteredArticles.length > 0);

  if (searchQuery && filteredArticles.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-tertiary transition-colors"
      >
        <div className="h-9 w-9 rounded-xl bg-surface flex items-center justify-center shrink-0">
          <Icon className={`h-4.5 w-4.5 ${section.color}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text">{section.title}</h3>
          <p className="text-[11px] text-text-tertiary">
            {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {filteredArticles.map((article, idx) => (
            <div
              key={idx}
              className="px-4 py-3 border-b border-border last:border-b-0"
            >
              <h4 className="text-sm font-medium text-text mb-1">
                {article.title}
              </h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                {article.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqAccordion({ faqs, searchQuery }: { faqs: FaqItem[]; searchQuery: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q),
    );
  }, [faqs, searchQuery]);

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-2">
      {filtered.map((faq, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="rounded-xl border border-border bg-surface-secondary overflow-hidden"
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-tertiary transition-colors"
            >
              <span className="text-sm font-medium text-text pr-4">
                {faq.question}
              </span>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-text-tertiary shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <p className="text-xs text-text-secondary leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShortcutsReference({ searchQuery }: { searchQuery: string }) {
  const shortcuts = useMemo(() => buildShortcuts(), []);
  const filtered = useMemo(() => {
    if (!searchQuery) return shortcuts;
    const q = searchQuery.toLowerCase();
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keys.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  if (filtered.length === 0) return null;

  const categories = [...new Set(filtered.map((s) => s.category))];

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            {cat}
          </h4>
          <div className="space-y-1">
            {filtered
              .filter((s) => s.category === cat)
              .map((s) => (
                <div
                  key={s.keys}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <span className="text-sm text-text">{s.label}</span>
                  <kbd className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-secondary border border-border text-xs font-mono text-text-secondary">
                    {s.keys}
                  </kbd>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type ActiveTab = "topics" | "faq" | "shortcuts";

function HelpPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("topics");

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: "topics", label: "Topics", icon: BookOpen },
    { id: "faq", label: "FAQ", icon: HelpCircle },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">{t("help.title", "Help Center")}</h1>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {t("help.subtitle", "Learn how to get the most out of NOVA. Search for a topic or browse the sections below.")}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("help.searchPlaceholder", "Search help articles, FAQ, shortcuts...")}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-tertiary field-glow transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-text-secondary hover:text-text"
                }`}
              >
                <TabIcon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === "topics" && (
          <div className="space-y-3">
            {helpSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                searchQuery={searchQuery}
              />
            ))}

            {searchQuery &&
              helpSections.every((s) => {
                const q = searchQuery.toLowerCase();
                return s.articles.every(
                  (a) =>
                    !a.title.toLowerCase().includes(q) &&
                    !a.body.toLowerCase().includes(q),
                );
              }) && (
                <div className="text-center py-12">
                  <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-text-secondary">
                    {t("help.noArticles", 'No articles matching "{{query}}"', { query: searchQuery })}
                  </p>
                </div>
              )}
          </div>
        )}

        {activeTab === "faq" && (
          <div>
            <FaqAccordion faqs={faqs} searchQuery={searchQuery} />
            {searchQuery &&
              faqs.every((f) => {
                const q = searchQuery.toLowerCase();
                return (
                  !f.question.toLowerCase().includes(q) &&
                  !f.answer.toLowerCase().includes(q)
                );
              }) && (
                <div className="text-center py-12">
                  <Search className="h-8 w-8 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm text-text-secondary">
                    {t("help.noFaq", 'No FAQ matching "{{query}}"', { query: searchQuery })}
                  </p>
                </div>
              )}
          </div>
        )}

        {activeTab === "shortcuts" && (
          <ShortcutsReference searchQuery={searchQuery} />
        )}

        {/* External docs link */}
        <div className="mt-10 p-4 rounded-xl border border-border bg-surface-secondary text-center">
          <p className="text-sm text-text-secondary mb-3">
            {t("help.needMoreDocs", "Need more detailed documentation?")}
          </p>
          <a
            href="https://github.com/nova-platform/nova"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            {t("help.visitDocs", "Visit project repository")}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
