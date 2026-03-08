import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  MessageSquare,
  Star,
  Calendar,
  Sparkles,
  Bot,
  Search,
  Plus,
  Settings,
  Bell,
  CheckCircle,
  AlertTriangle,
  AtSign,
  Info,
  Trash2,
  Shield,
  Zap,
  Brain,
  Code,
  Eye,
  Wrench,
} from "lucide-react";

const meta: Meta = {
  title: "Patterns/Compositions",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════════════════════
   1. CHAT MESSAGE THREAD
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatMessageThread() {
  return (
    <div className="max-w-2xl mx-auto space-y-1">
      {/* User Message */}
      <div className="flex gap-3 px-4 py-4">
        <Avatar name="Sarah Chen" size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text">Sarah Chen</span>
            <span className="text-[10px] text-text-tertiary">2:34 PM</span>
          </div>
          <div className="text-sm text-text leading-relaxed">
            Can you help me write a PostgreSQL query that finds the top 10 most active users
            by message count in the last 30 days? I also need their average response time.
          </div>
        </div>
      </div>

      {/* Assistant Message */}
      <div className="flex gap-3 px-4 py-4 bg-surface-secondary/50 rounded-xl">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text">NOVA</span>
            <Badge variant="primary">GPT-4o</Badge>
            <span className="text-[10px] text-text-tertiary">2:34 PM</span>
          </div>

          {/* Tool chips */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
              <CheckCircle className="h-2.5 w-2.5" /> schema_lookup
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
              <CheckCircle className="h-2.5 w-2.5" /> query_validator
            </span>
          </div>

          {/* Markdown-like content */}
          <div className="text-sm text-text leading-relaxed space-y-3">
            <p>Here's a query that finds the most active users with their average response times:</p>

            {/* Code block */}
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-tertiary border-b border-border">
                <span className="text-[10px] font-mono text-text-tertiary">sql</span>
                <button className="text-[10px] text-text-tertiary hover:text-text transition-colors">Copy</button>
              </div>
              <pre className="p-3 bg-surface-secondary text-xs font-mono text-text leading-relaxed overflow-x-auto">
{`SELECT
  u.id,
  u.display_name,
  COUNT(m.id) AS message_count,
  AVG(
    EXTRACT(EPOCH FROM m.created_at - LAG(m.created_at)
    OVER (PARTITION BY m.conversation_id ORDER BY m.created_at))
  ) AS avg_response_seconds
FROM users u
JOIN messages m ON m.sender_user_id = u.id
WHERE m.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.display_name
ORDER BY message_count DESC
LIMIT 10;`}
              </pre>
            </div>

            <p>A few notes about this query:</p>
            <ul className="space-y-1 pl-4">
              <li className="flex gap-2">
                <span className="text-primary mt-1.5 shrink-0">
                  <svg className="h-1.5 w-1.5" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                </span>
                <span>Uses a <code className="px-1 py-0.5 rounded bg-surface-tertiary text-xs font-mono">LAG()</code> window function to calculate time between consecutive messages</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-1.5 shrink-0">
                  <svg className="h-1.5 w-1.5" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                </span>
                <span>Partitions by conversation to ensure response time is measured within the same thread</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-1.5 shrink-0">
                  <svg className="h-1.5 w-1.5" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                </span>
                <span>Results are in seconds — divide by 60 for minutes if needed</span>
              </li>
            </ul>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 pt-1 text-[10px] text-text-tertiary">
            <span>847 tokens</span>
            <span>$0.003</span>
            <span>1.2s</span>
          </div>
        </div>
      </div>

      {/* Typing Indicator */}
      <div className="flex gap-3 px-4 py-3">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-1 py-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-text-tertiary"
              style={{
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export const ChatThread: Story = {
  name: "Chat Message Thread",
  render: () => <ChatMessageThread />,
  parameters: { layout: "padded" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. AGENT CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function AgentCardDemo() {
  const agents = [
    {
      name: "Research Analyst",
      avatar: "RA",
      desc: "Deep research agent that searches the web, reads papers, and synthesizes comprehensive reports with citations.",
      badges: ["reasoning", "search", "long-context"],
      conversations: 1240,
      rating: 4.8,
      created: "Jan 2026",
      featured: true,
    },
    {
      name: "Code Reviewer",
      avatar: "CR",
      desc: "Automated code review with security analysis, performance suggestions, and best practice recommendations.",
      badges: ["code", "tools", "security"],
      conversations: 856,
      rating: 4.6,
      created: "Feb 2026",
      featured: false,
    },
    {
      name: "Data Wizard",
      avatar: "DW",
      desc: "SQL generation, data visualization, and statistical analysis from natural language queries.",
      badges: ["code", "tools", "vision"],
      conversations: 2100,
      rating: 4.9,
      created: "Dec 2025",
      featured: true,
    },
  ];

  const badgeIconMap: Record<string, React.ReactNode> = {
    reasoning: <Brain className="h-2.5 w-2.5" />,
    search: <Search className="h-2.5 w-2.5" />,
    "long-context": <MessageSquare className="h-2.5 w-2.5" />,
    code: <Code className="h-2.5 w-2.5" />,
    tools: <Wrench className="h-2.5 w-2.5" />,
    security: <Shield className="h-2.5 w-2.5" />,
    vision: <Eye className="h-2.5 w-2.5" />,
  };

  return (
    <div className="grid grid-cols-3 gap-4 max-w-3xl">
      {agents.map((agent) => (
        <div
          key={agent.name}
          className="group relative p-5 rounded-xl bg-surface-secondary border border-border hover-lift transition-all duration-200 cursor-pointer"
        >
          {agent.featured && (
            <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-accent text-[10px] font-semibold text-text">
              Featured
            </div>
          )}

          <div className="flex items-start gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text truncate">{agent.name}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < Math.floor(agent.rating) ? "text-accent fill-accent" : "text-border-strong"}`}
                  />
                ))}
                <span className="text-[10px] text-text-tertiary ml-1">{agent.rating}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed mb-4 line-clamp-3">
            {agent.desc}
          </p>

          <div className="flex flex-wrap gap-1 mb-4">
            {agent.badges.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/8 text-primary"
              >
                {badgeIconMap[b]}
                {b}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-text-tertiary pt-3 border-t border-border">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {agent.conversations.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {agent.created}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <Button size="sm" className="flex-1 text-xs">
              <Zap className="h-3 w-3" /> Use
            </Button>
            <Button variant="ghost" size="sm" className="text-xs">
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export const AgentCard: Story = {
  name: "Agent Cards",
  render: () => <AgentCardDemo />,
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function Toggle({ checked = false, label, description }: { checked?: boolean; label: string; description: string }) {
  return (
    <label className="flex items-start gap-4 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border-strong"}`}>
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`}
          />
        </div>
      </div>
      <div>
        <span className="text-sm font-medium text-text group-hover:text-primary transition-colors">{label}</span>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function SettingsPanelDemo() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-text">Workspace Settings</h2>
        <p className="text-sm text-text-secondary mt-1">Manage your workspace preferences and configuration.</p>
      </div>

      {/* General Section */}
      <section className="space-y-5">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">General</h3>
        </div>
        <Input label="Workspace Name" defaultValue="Engineering Team" />
        <Input label="Description" placeholder="Optional workspace description..." />
      </section>

      {/* Model Preferences */}
      <section className="space-y-5">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Model Preferences</h3>
        </div>
        <div className="space-y-4">
          <Toggle checked label="Enable streaming responses" description="Show assistant responses as they're generated in real-time." />
          <Toggle checked={false} label="Auto-select model" description="Let NOVA choose the best model for each query based on complexity." />
          <Toggle checked label="Save conversation history" description="Store all conversations for future reference and search." />
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-5">
        <div className="pb-2 border-b border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Notifications</h3>
        </div>
        <div className="space-y-4">
          <Toggle checked label="Email notifications" description="Receive email alerts for mentions and important updates." />
          <Toggle checked={false} label="Desktop notifications" description="Show browser notifications for new messages." />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button>Save Changes</Button>
        <Button variant="ghost">Cancel</Button>
      </div>

      {/* Danger Zone */}
      <section className="space-y-4">
        <div className="pb-2 border-b border-danger/30">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-danger">Danger Zone</h3>
        </div>
        <div className="p-4 rounded-xl border border-danger/20 bg-danger/5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">Delete Workspace</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Permanently delete this workspace and all associated data. This action cannot be undone.
              </p>
            </div>
            <Button variant="danger" size="sm">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export const SettingsPanel: Story = {
  name: "Settings Panel",
  render: () => <SettingsPanelDemo />,
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. EMPTY STATES
   ═══════════════════════════════════════════════════════════════════════════ */

function EmptyStateItem({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center p-8 rounded-xl border border-dashed border-border bg-surface-secondary/50">
      <div className="mb-4">{icon}</div>
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-tertiary max-w-xs mb-5 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

function EmptyStatesDemo() {
  return (
    <div className="space-y-6 max-w-sm">
      <EmptyStateItem
        icon={
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-primary/60" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-accent/20 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-accent" />
            </div>
          </div>
        }
        title="No conversations yet"
        description="Start a new conversation to chat with AI models, generate code, analyze data, and more."
        action={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> New Conversation
          </Button>
        }
      />

      <EmptyStateItem
        icon={
          <div className="h-16 w-16 rounded-2xl bg-surface-tertiary flex items-center justify-center">
            <Search className="h-7 w-7 text-text-tertiary/40" />
          </div>
        }
        title="No results found"
        description='We couldn&apos;t find anything matching "vector database optimization". Try different keywords or filters.'
        action={
          <Button variant="secondary" size="sm">
            Clear Search
          </Button>
        }
      />

      <EmptyStateItem
        icon={
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center">
              <Bot className="h-7 w-7 text-primary/60" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-surface border-2 border-surface-secondary flex items-center justify-center">
              <Plus className="h-2.5 w-2.5 text-text-tertiary" />
            </div>
          </div>
        }
        title="No agents configured"
        description="Create custom agents with specialized prompts, tools, and knowledge bases for your team."
        action={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Create Agent
          </Button>
        }
      />
    </div>
  );
}

export const EmptyState: Story = {
  name: "Empty States",
  render: () => <EmptyStatesDemo />,
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. NOTIFICATION STACK
   ═══════════════════════════════════════════════════════════════════════════ */

interface NotificationItem {
  id: string;
  type: "mention" | "system" | "error" | "success";
  title: string;
  body: string;
  time: string;
  read: boolean;
  avatar?: string;
}

function NotificationEntry({ n }: { n: NotificationItem }) {
  const iconMap = {
    mention: <AtSign className="h-3.5 w-3.5 text-primary" />,
    system: <Info className="h-3.5 w-3.5 text-text-secondary" />,
    error: <AlertTriangle className="h-3.5 w-3.5 text-danger" />,
    success: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  };

  const bgMap = {
    mention: "bg-primary/8",
    system: "bg-surface-tertiary",
    error: "bg-danger/8",
    success: "bg-success/8",
  };

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
        n.read ? "opacity-60 hover:opacity-80" : "hover:bg-surface-tertiary"
      }`}
    >
      {n.avatar ? (
        <Avatar name={n.avatar} size="sm" />
      ) : (
        <div className={`h-7 w-7 rounded-full ${bgMap[n.type]} flex items-center justify-center shrink-0`}>
          {iconMap[n.type]}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${n.read ? "text-text-secondary" : "text-text font-medium"} leading-snug`}>
            {n.title}
          </p>
          {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
        </div>
        <p className="text-xs text-text-tertiary mt-0.5 truncate">{n.body}</p>
        <p className="text-[10px] text-text-tertiary mt-1">{n.time}</p>
      </div>
    </div>
  );
}

function NotificationStackDemo() {
  const notifications: NotificationItem[] = [
    {
      id: "1",
      type: "mention",
      title: "Alex Kim mentioned you",
      body: "@sarah can you review the agent config changes?",
      time: "2 min ago",
      read: false,
      avatar: "Alex Kim",
    },
    {
      id: "2",
      type: "success",
      title: "Deployment complete",
      body: "NOVA v2.4.1 deployed successfully to production.",
      time: "15 min ago",
      read: false,
    },
    {
      id: "3",
      type: "error",
      title: "Agent execution failed",
      body: "Research Analyst encountered a timeout after 30s.",
      time: "1 hour ago",
      read: false,
    },
    {
      id: "4",
      type: "system",
      title: "New model available",
      body: "Claude 4.5 Sonnet has been added to your model roster.",
      time: "3 hours ago",
      read: true,
    },
    {
      id: "5",
      type: "mention",
      title: "Carol Wu replied to your thread",
      body: "The SQL query optimization looks great, just one suggestion...",
      time: "Yesterday",
      read: true,
      avatar: "Carol Wu",
    },
  ];

  return (
    <div className="w-96">
      <div className="rounded-xl bg-surface border border-border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-text-secondary" />
            <span className="text-sm font-semibold text-text">Notifications</span>
            <Badge variant="primary">3</Badge>
          </div>
          <button className="text-xs text-primary hover:text-primary-dark transition-colors font-medium">
            Mark all read
          </button>
        </div>

        {/* List */}
        <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <NotificationEntry key={n.id} n={n} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border text-center">
          <button className="text-xs text-text-secondary hover:text-text transition-colors font-medium">
            View all notifications
          </button>
        </div>
      </div>
    </div>
  );
}

export const NotificationStack: Story = {
  name: "Notification Stack",
  render: () => <NotificationStackDemo />,
};
