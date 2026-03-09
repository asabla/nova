import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  MessageSquare,
  Plus,
  Search,
  Settings,
  Bot,
  BookOpen,
  BarChart3,
  Sparkles,
  Send,
  Paperclip,
  ChevronRight,
  MoreHorizontal,
  Hash,
  Star,
  CheckCircle,
  Command,
} from "lucide-react";

const meta: Meta = {
  title: "NOVA/Showcase",
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
    actions: { disable: true },
  },
};

export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════════════════════
   APPLICATION SHOWCASE — The full NOVA experience at a glance
   ═══════════════════════════════════════════════════════════════════════════ */

function SidebarConversation({
  title,
  time,
  active = false,
  avatar,
}: {
  title: string;
  time: string;
  active?: boolean;
  avatar: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-tertiary hover:text-text"
      }`}
    >
      <Avatar name={avatar} size="xs" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${active ? "font-semibold" : "font-medium"}`}>{title}</p>
        <p className="text-[10px] text-text-tertiary truncate">{time}</p>
      </div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-text-secondary hover:bg-surface-tertiary hover:text-text"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
          {badge}
        </span>
      )}
    </div>
  );
}

function ApplicationShowcaseComponent() {
  return (
    <div className="h-[680px] flex bg-surface overflow-hidden rounded-xl border border-border shadow-2xl">
      {/* ─── Sidebar ─── */}
      <aside className="w-64 bg-surface-secondary border-r border-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-sm font-bold text-text tracking-tight">NOVA</span>
              <span className="text-[10px] text-text-tertiary block -mt-0.5">AI Platform</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-tertiary text-text-tertiary text-xs cursor-pointer hover:bg-border/50 transition-colors">
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1">Search...</span>
            <kbd className="px-1 py-0.5 rounded bg-surface-secondary border border-border text-[10px] font-mono">
              <Command className="h-2.5 w-2.5 inline" />K
            </kbd>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-2 space-y-0.5">
          <NavItem icon={MessageSquare} label="Conversations" active badge="12" />
          <NavItem icon={Bot} label="Agents" />
          <NavItem icon={BookOpen} label="Knowledge" />
          <NavItem icon={BarChart3} label="Analytics" />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto mt-4 px-2">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Recent</span>
            <button className="p-0.5 rounded text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            <SidebarConversation title="PostgreSQL optimization tips" time="Just now" active avatar="NOVA" />
            <SidebarConversation title="React 19 migration plan" time="2h ago" avatar="Sarah Chen" />
            <SidebarConversation title="API rate limiting design" time="Yesterday" avatar="Alex Kim" />
            <SidebarConversation title="Docker compose setup" time="2 days ago" avatar="NOVA" />
            <SidebarConversation title="TypeScript strict mode" time="3 days ago" avatar="Carol Wu" />
            <SidebarConversation title="Vector DB comparison" time="1 week ago" avatar="NOVA" />
          </div>
        </div>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2.5">
            <Avatar name="Sarah Chen" size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text truncate">Sarah Chen</p>
              <p className="text-[10px] text-text-tertiary">Engineering</p>
            </div>
            <button className="p-1 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-tertiary">Conversations</span>
            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="font-medium text-text">PostgreSQL optimization tips</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary">GPT-4o</Badge>
            <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors">
              <Star className="h-4 w-4" />
            </button>
            <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {/* User message */}
          <div className="flex gap-3 py-3">
            <Avatar name="Sarah Chen" size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-text">Sarah Chen</span>
                <span className="text-[10px] text-text-tertiary">14:30</span>
              </div>
              <p className="text-sm text-text leading-relaxed">
                What are the best practices for indexing JSONB columns in PostgreSQL? I have a table with
                about 10M rows and queries are getting slow.
              </p>
            </div>
          </div>

          {/* Assistant message */}
          <div className="flex gap-3 py-3 bg-surface-secondary/50 -mx-2 px-5 rounded-xl">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-text">NOVA</span>
                <Badge variant="primary">GPT-4o</Badge>
                <span className="text-[10px] text-text-tertiary">14:31</span>
              </div>

              {/* Tool chips */}
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
                  <CheckCircle className="h-2.5 w-2.5" /> docs_search
                </span>
              </div>

              <div className="text-sm text-text leading-relaxed space-y-2.5">
                <p>
                  Great question! For JSONB indexing at scale, here are the key strategies:
                </p>
                <p className="font-semibold text-text">1. GIN Indexes for containment queries</p>
                <p className="text-text-secondary">
                  Use <code className="px-1 py-0.5 rounded bg-surface-tertiary text-xs font-mono">jsonb_path_ops</code> for
                  smaller, faster indexes when you only need <code className="px-1 py-0.5 rounded bg-surface-tertiary text-xs font-mono">@&gt;</code> queries:
                </p>
                <div className="rounded-lg overflow-hidden border border-border">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-tertiary border-b border-border">
                    <span className="text-[10px] font-mono text-text-tertiary">sql</span>
                  </div>
                  <pre className="p-3 bg-surface-secondary text-xs font-mono text-text leading-relaxed overflow-x-auto">
{`CREATE INDEX idx_data_gin ON events
USING GIN (data jsonb_path_ops);`}
                  </pre>
                </div>
                <p className="font-semibold text-text">2. Expression indexes for specific keys</p>
                <p className="text-text-secondary">
                  If you frequently query a specific path, a B-tree on the expression is often fastest:
                </p>
                <div className="rounded-lg overflow-hidden border border-border">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-tertiary border-b border-border">
                    <span className="text-[10px] font-mono text-text-tertiary">sql</span>
                  </div>
                  <pre className="p-3 bg-surface-secondary text-xs font-mono text-text leading-relaxed overflow-x-auto">
{`CREATE INDEX idx_data_user ON events
  ((data->>'user_id'));`}
                  </pre>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1 text-[10px] text-text-tertiary">
                <span>1,240 tokens</span>
                <span>$0.005</span>
                <span>1.8s</span>
              </div>
            </div>
          </div>

          {/* Follow-up user message */}
          <div className="flex gap-3 py-3">
            <Avatar name="Sarah Chen" size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-text">Sarah Chen</span>
                <span className="text-[10px] text-text-tertiary">14:34</span>
              </div>
              <p className="text-sm text-text leading-relaxed">
                That's really helpful! Can you also show me how to benchmark these indexes to see which performs better for my specific query patterns?
              </p>
            </div>
          </div>

          {/* Typing */}
          <div className="flex gap-3 py-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex items-center gap-1.5 py-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-text-tertiary"
                  style={{
                    animation: "showcase-pulse 1.4s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-border bg-surface">
          <div className="relative flex items-end gap-2 rounded-xl border border-border bg-surface-secondary p-3 input-glow focus-within:border-primary/50 transition-all">
            <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors shrink-0">
              <Paperclip className="h-4 w-4" />
            </button>
            <div className="flex-1 min-h-[24px] text-sm text-text-tertiary py-0.5">
              Type a message...
            </div>
            <button className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shrink-0">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-text-tertiary">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" /> Markdown
              </span>
              <span>|</span>
              <span>
                <kbd className="font-mono">Enter</kbd> to send
              </span>
            </div>
            <span>GPT-4o · 128K context</span>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes showcase-pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export const ApplicationShowcase: Story = {
  name: "Full Application",
  render: () => <ApplicationShowcaseComponent />,
};
