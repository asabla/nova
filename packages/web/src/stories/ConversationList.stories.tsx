import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  MessageSquare, Pin, Archive, Trash2, MoreHorizontal,
  Search, Plus, Filter, ChevronLeft, Zap,
  Settings, HelpCircle, BookOpen, FolderKanban,
  Compass, Microscope, HardDrive, FolderOpen,
  CheckSquare, Square,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Patterns/ConversationList",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

// ── Mock Data ────────────────────────────────────────────────────────────

interface MockConversation {
  id: string;
  title: string | null;
  model: string;
  isPinned: boolean;
  updatedAt: Date;
  messageCount: number;
  workspace?: string;
}

const now = new Date();
const hours = (h: number) => new Date(now.getTime() - h * 3600_000);
const days = (d: number) => new Date(now.getTime() - d * 86400_000);

const conversations: MockConversation[] = [
  // Pinned
  { id: "1", title: "Project Architecture Overview", model: "claude-sonnet-4", isPinned: true, updatedAt: hours(1), messageCount: 42, workspace: "Engineering" },
  { id: "2", title: "API Design Guidelines", model: "claude-sonnet-4", isPinned: true, updatedAt: days(2), messageCount: 18 },
  // Today
  { id: "3", title: "How to implement RAG with embeddings", model: "claude-sonnet-4", isPinned: false, updatedAt: hours(0.5), messageCount: 12 },
  { id: "4", title: "Debug WebSocket reconnection issue", model: "claude-haiku-4-5", isPinned: false, updatedAt: hours(2), messageCount: 8 },
  { id: "5", title: null, model: "claude-sonnet-4", isPinned: false, updatedAt: hours(4), messageCount: 3 },
  // Yesterday
  { id: "6", title: "Tailwind v4 migration plan", model: "claude-sonnet-4", isPinned: false, updatedAt: days(1), messageCount: 24 },
  { id: "7", title: "Database schema review", model: "claude-sonnet-4", isPinned: false, updatedAt: days(1.2), messageCount: 15, workspace: "Engineering" },
  { id: "8", title: "Write unit tests for auth middleware", model: "claude-haiku-4-5", isPinned: false, updatedAt: days(1.5), messageCount: 31 },
  // This week
  { id: "9", title: "Compare vector databases", model: "claude-sonnet-4", isPinned: false, updatedAt: days(3), messageCount: 9 },
  { id: "10", title: "Draft product roadmap Q2", model: "claude-sonnet-4", isPinned: false, updatedAt: days(4), messageCount: 6, workspace: "Product" },
  { id: "11", title: "Stripe webhook integration", model: "claude-haiku-4-5", isPinned: false, updatedAt: days(5), messageCount: 19 },
  // Older
  { id: "12", title: "Docker multi-stage build optimization", model: "claude-sonnet-4", isPinned: false, updatedAt: days(10), messageCount: 14 },
  { id: "13", title: "React 19 migration notes", model: "claude-sonnet-4", isPinned: false, updatedAt: days(14), messageCount: 22 },
  { id: "14", title: "CI/CD pipeline setup", model: "claude-haiku-4-5", isPinned: false, updatedAt: days(21), messageCount: 37 },
];

function groupConversations(convs: MockConversation[]) {
  const pinned = convs.filter((c) => c.isPinned);
  const unpinned = convs.filter((c) => !c.isPinned);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400_000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400_000);

  const today = unpinned.filter((c) => c.updatedAt >= todayStart);
  const yesterday = unpinned.filter((c) => c.updatedAt >= yesterdayStart && c.updatedAt < todayStart);
  const thisWeek = unpinned.filter((c) => c.updatedAt >= weekStart && c.updatedAt < yesterdayStart);
  const older = unpinned.filter((c) => c.updatedAt < weekStart);

  return { pinned, today, yesterday, thisWeek, older };
}

// ── Components ───────────────────────────────────────────────────────────

function NavLink({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <button
      className={clsx(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ConversationItem({
  conv,
  active,
  bulkMode,
  selected,
  onToggle,
}: {
  conv: MockConversation;
  active?: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors group",
        active
          ? "bg-primary/10 text-primary"
          : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
      )}
    >
      {bulkMode && (
        selected
          ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
          : <Square className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
      )}
      {!bulkMode && conv.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
      <span className="truncate flex-1">{conv.title ?? "Untitled"}</span>
      {conv.workspace && (
        <FolderOpen className="h-3 w-3 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
      {children}
    </p>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Full sidebar with date-grouped conversation list */
export const Default: Story = {
  render: () => {
    const [activeId, setActiveId] = useState("3");
    const [search, setSearch] = useState("");

    const filtered = search
      ? conversations.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()))
      : conversations;
    const groups = groupConversations(filtered);

    return (
      <div className="flex h-[640px] bg-surface">
        <aside className="w-[280px] flex flex-col bg-surface-secondary border-r border-border">
          {/* Brand */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
            </div>
            <button className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="px-2 pt-3 pb-2 space-y-0.5">
            <NavLink icon={MessageSquare} label="Conversations" active />
            <NavLink icon={Microscope} label="Research" />
            <NavLink icon={BookOpen} label="Knowledge" />
            <NavLink icon={Compass} label="Explore" />
            <NavLink icon={FolderKanban} label="Workspaces" />
            <NavLink icon={HardDrive} label="Files" />
          </nav>

          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

          {/* Search */}
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary field-glow"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {groups.pinned.length > 0 && (
              <>
                <GroupLabel>Pinned</GroupLabel>
                {groups.pinned.map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onToggle={() => setActiveId(c.id)} />
                ))}
              </>
            )}
            {groups.today.length > 0 && (
              <>
                <GroupLabel>Today</GroupLabel>
                {groups.today.map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onToggle={() => setActiveId(c.id)} />
                ))}
              </>
            )}
            {groups.yesterday.length > 0 && (
              <>
                <GroupLabel>Yesterday</GroupLabel>
                {groups.yesterday.map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onToggle={() => setActiveId(c.id)} />
                ))}
              </>
            )}
            {groups.thisWeek.length > 0 && (
              <>
                <GroupLabel>This Week</GroupLabel>
                {groups.thisWeek.map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onToggle={() => setActiveId(c.id)} />
                ))}
              </>
            )}
            {groups.older.length > 0 && (
              <>
                <GroupLabel>Older</GroupLabel>
                {groups.older.map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onToggle={() => setActiveId(c.id)} />
                ))}
              </>
            )}
          </div>

          {/* Bottom nav */}
          <div className="border-t border-border px-2 py-2 space-y-0.5">
            <NavLink icon={Settings} label="Settings" />
            <NavLink icon={HelpCircle} label="Help" />
          </div>
        </aside>

        {/* Main content placeholder */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">
              {conversations.find((c) => c.id === activeId)?.title ?? "Untitled"}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {conversations.find((c) => c.id === activeId)?.messageCount} messages
            </p>
          </div>
        </div>
      </div>
    );
  },
};

/** Bulk selection mode with archive/delete actions */
export const BulkSelect: Story = {
  render: () => {
    const [selected, setSelected] = useState<Set<string>>(new Set(["6", "7"]));
    const groups = groupConversations(conversations);
    const allUnpinned = [...groups.today, ...groups.yesterday, ...groups.thisWeek, ...groups.older];

    const toggle = (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    return (
      <div className="w-[280px] h-[500px] flex flex-col bg-surface-secondary border border-border rounded-xl overflow-hidden">
        {/* Bulk actions bar */}
        <div className="px-3 py-2 border-b border-border bg-surface-secondary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text">{selected.size} selected</span>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[10px] text-text-tertiary hover:text-text transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-1.5">
            <button className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-border rounded-lg text-text-secondary hover:text-text transition-colors">
              <Archive className="h-3 w-3" />
              Archive ({selected.size})
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-danger/30 rounded-lg text-danger hover:bg-danger/5 transition-colors">
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>

        {/* Conversation list in bulk mode */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <GroupLabel>Pinned</GroupLabel>
          {groups.pinned.map((c) => (
            <ConversationItem key={c.id} conv={c} bulkMode selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
          <GroupLabel>Today</GroupLabel>
          {groups.today.map((c) => (
            <ConversationItem key={c.id} conv={c} bulkMode selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
          <GroupLabel>Yesterday</GroupLabel>
          {groups.yesterday.map((c) => (
            <ConversationItem key={c.id} conv={c} bulkMode selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
          {allUnpinned.length > groups.today.length + groups.yesterday.length && (
            <>
              <GroupLabel>This Week</GroupLabel>
              {groups.thisWeek.map((c) => (
                <ConversationItem key={c.id} conv={c} bulkMode selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
              ))}
            </>
          )}
        </div>
      </div>
    );
  },
};

/** Empty state — no conversations yet */
export const Empty: Story = {
  render: () => (
    <div className="w-[280px] h-[400px] flex flex-col bg-surface-secondary border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="h-12 w-12 rounded-xl bg-surface-tertiary flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="h-6 w-6 text-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-text mb-1">No conversations yet</p>
          <p className="text-xs text-text-tertiary mb-4">Start a new conversation to get going</p>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Conversation
          </Button>
        </div>
      </div>
    </div>
  ),
};

/** Collapsed sidebar — icon-only navigation */
export const Collapsed: Story = {
  render: () => (
    <div className="flex h-[500px] bg-surface">
      <aside className="w-14 flex flex-col items-center bg-surface-secondary border-r border-border py-3 gap-1">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        {[MessageSquare, Microscope, BookOpen, Compass, FolderKanban, HardDrive].map((Icon, i) => (
          <button
            key={i}
            className={clsx(
              "h-9 w-9 flex items-center justify-center rounded-lg transition-colors",
              i === 0 ? "bg-primary/10 text-primary" : "text-text-tertiary hover:bg-surface-tertiary hover:text-text",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="flex-1" />
        <button className="h-9 w-9 flex items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-tertiary hover:text-text transition-colors">
          <Settings className="h-4 w-4" />
        </button>
      </aside>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-tertiary">Sidebar collapsed</p>
      </div>
    </div>
  ),
};

/** Filtered by workspace */
export const FilteredByWorkspace: Story = {
  render: () => {
    const engineering = conversations.filter((c) => c.workspace === "Engineering");
    const groups = groupConversations(engineering);

    return (
      <div className="w-[280px] h-[400px] flex flex-col bg-surface-secondary border border-border rounded-xl overflow-hidden">
        <div className="px-3 pt-3 pb-1 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
              readOnly
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="primary">Engineering</Badge>
            <button className="text-[10px] text-text-tertiary hover:text-text">Clear filter</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {groups.pinned.length > 0 && (
            <>
              <GroupLabel>Pinned</GroupLabel>
              {groups.pinned.map((c) => (
                <ConversationItem key={c.id} conv={c} />
              ))}
            </>
          )}
          {groups.yesterday.length > 0 && (
            <>
              <GroupLabel>Yesterday</GroupLabel>
              {groups.yesterday.map((c) => (
                <ConversationItem key={c.id} conv={c} />
              ))}
            </>
          )}
        </div>
        <div className="px-3 py-2 border-t border-border">
          <p className="text-[10px] text-text-tertiary text-center">
            {engineering.length} conversations in Engineering
          </p>
        </div>
      </div>
    );
  },
};
