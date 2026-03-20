import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  MessageSquare, Pin, Archive, Trash2,
  Search, Plus, Filter, Zap, X, Loader2,
  Settings, HelpCircle, BookOpen,
  Compass, Microscope, HardDrive, FolderOpen,
  CheckSquare, Square, PanelLeftClose, PanelLeft,
  ChevronRight, ChevronDown, Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Layout/Sidebar",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

// ── Mock Data ────────────────────────────────────────────────────────────

interface MockConversation {
  id: string;
  title: string | null;
  model: string;
  modelShort: string;
  isPinned: boolean;
  updatedAt: Date;
  messageCount: number;
  tags?: { id: string; name: string; color: string }[];
}

const now = new Date();
const hours = (h: number) => new Date(now.getTime() - h * 3600_000);
const days = (d: number) => new Date(now.getTime() - d * 86400_000);

const mockTags = [
  { id: "t1", name: "Engineering", color: "#3b82f6" },
  { id: "t2", name: "Product", color: "#8b5cf6" },
  { id: "t3", name: "Research", color: "#10b981" },
  { id: "t4", name: "Design", color: "#f59e0b" },
  { id: "t5", name: "Urgent", color: "#ef4444" },
];

const mockFolders = [
  { id: "f1", name: "Active Projects", conversationCount: 12 },
  { id: "f2", name: "Architecture", conversationCount: 5 },
  { id: "f3", name: "Bug Reports", conversationCount: 8 },
  { id: "f4", name: "Meeting Notes", conversationCount: 3 },
];

const conversations: MockConversation[] = [
  { id: "1", title: "Project Architecture Overview", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: true, updatedAt: hours(1), messageCount: 42, tags: [mockTags[0], mockTags[2]] },
  { id: "2", title: "API Design Guidelines", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: true, updatedAt: days(2), messageCount: 18, tags: [mockTags[0]] },
  { id: "3", title: "How to implement RAG with embeddings", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: hours(0.5), messageCount: 12, tags: [mockTags[2]] },
  { id: "4", title: "Debug WebSocket reconnection issue", model: "claude-haiku-4-5", modelShort: "Haiku 4.5", isPinned: false, updatedAt: hours(2), messageCount: 8, tags: [mockTags[0], mockTags[4]] },
  { id: "5", title: null, model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: hours(4), messageCount: 3 },
  { id: "6", title: "Tailwind v4 migration plan", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: days(1), messageCount: 24, tags: [mockTags[3]] },
  { id: "7", title: "Database schema review", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: days(1.2), messageCount: 15 },
  { id: "8", title: "Write unit tests for auth middleware", model: "claude-haiku-4-5", modelShort: "Haiku 4.5", isPinned: false, updatedAt: days(1.5), messageCount: 31 },
  { id: "9", title: "Compare vector databases", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: days(3), messageCount: 9, tags: [mockTags[2]] },
  { id: "10", title: "Draft product roadmap Q2", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: days(4), messageCount: 6, tags: [mockTags[1]] },
  { id: "11", title: "Stripe webhook integration", model: "claude-haiku-4-5", modelShort: "Haiku 4.5", isPinned: false, updatedAt: days(5), messageCount: 19 },
  { id: "12", title: "Docker multi-stage build optimization", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: days(10), messageCount: 14 },
  { id: "13", title: "React 19 migration notes", model: "claude-sonnet-4", modelShort: "Sonnet 4", isPinned: false, updatedAt: days(14), messageCount: 22 },
];

const mockSearchResults = [
  { id: "3", title: "How to implement RAG with embeddings", snippet: "...using vector embeddings to retrieve relevant documents...", updatedAt: hours(0.5) },
  { id: "9", title: "Compare vector databases", snippet: "...Pinecone vs Qdrant vs pgvector performance benchmarks...", updatedAt: days(3) },
  { id: "12", title: "Docker multi-stage build optimization", snippet: "...reducing image size with multi-stage builds and caching...", updatedAt: days(10) },
  { id: "7", title: "Database schema review", snippet: "...reviewing the relationships between conversation tables...", updatedAt: days(1.2) },
];

// ── Helpers ────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date) {
  const diff = now.getTime() - date.getTime();
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  if (diff < 7 * 86400_000) return `${Math.round(diff / 86400_000)}d ago`;
  return `${Math.round(diff / (7 * 86400_000))}w ago`;
}

function groupConversations(convs: MockConversation[]) {
  const pinned = convs.filter((c) => c.isPinned);
  const unpinned = convs.filter((c) => !c.isPinned);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400_000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400_000);
  return {
    pinned,
    today: unpinned.filter((c) => c.updatedAt >= todayStart),
    yesterday: unpinned.filter((c) => c.updatedAt >= yesterdayStart && c.updatedAt < todayStart),
    thisWeek: unpinned.filter((c) => c.updatedAt >= weekStart && c.updatedAt < yesterdayStart),
    older: unpinned.filter((c) => c.updatedAt < weekStart),
  };
}

// ── Shared Components ──────────────────────────────────────────────────

function NavLink({ icon: Icon, label, active, collapsed }: { icon: any; label: string; active?: boolean; collapsed?: boolean }) {
  return (
    <button
      className={clsx(
        "w-full flex items-center rounded-lg transition-all duration-150",
        collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-3 py-2 text-sm",
        active ? "bg-primary/10 text-primary font-medium" : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
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

function ConversationItem({
  conv, active, bulkMode, selected, onToggle,
}: {
  conv: MockConversation; active?: boolean; bulkMode?: boolean; selected?: boolean; onToggle?: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={clsx(
        "w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-colors group",
        active ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
      )}
    >
      {bulkMode && (
        selected
          ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          : <Square className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" />
      )}
      {!bulkMode && conv.isPinned && <Pin className="h-3 w-3 text-primary shrink-0 mt-1" />}
      <div className="flex-1 min-w-0">
        <span className="block truncate text-sm">{conv.title ?? "Untitled"}</span>
        <span className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-tertiary">
          <span>{formatRelativeTime(conv.updatedAt)}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="truncate">{conv.modelShort}</span>
          {conv.tags && conv.tags.length > 0 && (
            <>
              <span aria-hidden="true">&middot;</span>
              {conv.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                  title={tag.name}
                />
              ))}
            </>
          )}
        </span>
      </div>
    </button>
  );
}

function SidebarShell({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) {
  return (
    <div className="flex h-[640px] bg-surface">
      <aside className={clsx("flex flex-col bg-surface-secondary border-r border-border", collapsed ? "w-14" : "w-[280px]")}>
        {children}
      </aside>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-tertiary">Content area</p>
      </div>
    </div>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Default expanded sidebar with date-grouped conversations and metadata */
export const Default: Story = {
  render: () => {
    const [activeId, setActiveId] = useState("3");
    const [search, setSearch] = useState("");

    const filtered = search
      ? conversations.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()))
      : conversations;
    const groups = groupConversations(filtered);

    return (
      <SidebarShell>
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
          </div>
          <button className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="px-2 pt-3 pb-2 space-y-0.5">
          <NavLink icon={MessageSquare} label="Conversations" active />
          <NavLink icon={Microscope} label="Research" />
          <NavLink icon={BookOpen} label="Knowledge" />
          <NavLink icon={Compass} label="Explore" />
          <NavLink icon={HardDrive} label="Files" />
          <NavLink icon={FolderOpen} label="Folders" />
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

        {/* Search */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative input-glow rounded-lg">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="px-3 pt-2 flex gap-1.5">
          <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
            <Filter className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
            <CheckSquare className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {(["pinned", "today", "yesterday", "thisWeek", "older"] as const).map((key) => {
            const label = { pinned: "Pinned", today: "Today", yesterday: "Yesterday", thisWeek: "This Week", older: "Older" }[key];
            return groups[key].length > 0 ? (
              <div key={key}>
                <GroupLabel>{label}</GroupLabel>
                {groups[key].map((c) => (
                  <ConversationItem key={c.id} conv={c} active={c.id === activeId} onToggle={() => setActiveId(c.id)} />
                ))}
              </div>
            ) : null;
          })}
        </div>

        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <NavLink icon={Settings} label="Settings" />
          <NavLink icon={HelpCircle} label="Help" />
        </div>
      </SidebarShell>
    );
  },
};

/** Search active — flat results with snippets from message content */
export const WithSearch: Story = {
  render: () => {
    const [search, setSearch] = useState("vector");

    return (
      <SidebarShell>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
          </div>
        </div>

        <nav className="px-2 pt-3 pb-2 space-y-0.5">
          <NavLink icon={MessageSquare} label="Conversations" active />
          <NavLink icon={Microscope} label="Research" />
          <NavLink icon={BookOpen} label="Knowledge" />
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

        <div className="px-3 pt-3 pb-1">
          <div className="relative input-glow rounded-lg">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
            />
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-text-tertiary mt-1 px-1">Searching messages...</p>
        </div>

        {/* Search results — flat list with snippets */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {mockSearchResults.map((result) => (
            <button
              key={result.id}
              className="w-full flex flex-col gap-0.5 px-3 py-2 rounded-lg text-left text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
            >
              <span className="text-sm truncate">{result.title}</span>
              <span className="text-[10px] text-text-tertiary truncate">{result.snippet}</span>
              <span className="text-[10px] text-text-tertiary">{formatRelativeTime(result.updatedAt as any)}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <NavLink icon={Settings} label="Settings" />
        </div>
      </SidebarShell>
    );
  },
};

/** Filter panel expanded with date, tags, and model filters active */
export const WithFilters: Story = {
  render: () => {
    const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("week");
    const [activeTags, setActiveTags] = useState<Set<string>>(new Set(["t1", "t3"]));

    const toggleTag = (id: string) => {
      setActiveTags((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const activeCount = (dateRange !== "all" ? 1 : 0) + (activeTags.size > 0 ? 1 : 0) + 1; // +1 for model

    return (
      <SidebarShell>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
          </div>
        </div>

        <nav className="px-2 pt-3 pb-2 space-y-0.5">
          <NavLink icon={MessageSquare} label="Conversations" active />
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

        <div className="px-3 pt-3 pb-1">
          <div className="relative input-glow rounded-lg">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input type="text" placeholder="Search conversations..." className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary" readOnly />
          </div>
        </div>

        {/* Controls with filter count */}
        <div className="px-3 pt-2 flex items-center gap-1.5">
          <button className="relative p-1.5 rounded-lg bg-primary/10 text-primary transition-colors">
            <Filter className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
              {activeCount}
            </span>
          </button>
          <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
            <CheckSquare className="h-4 w-4" />
          </button>
          <button className="ml-auto text-[10px] text-text-tertiary hover:text-primary transition-colors">
            Clear all
          </button>
        </div>

        {/* Expanded filter panel */}
        <div className="px-3 pt-2 space-y-2">
          {/* Date range */}
          <div>
            <p className="text-[10px] font-medium text-text-tertiary mb-1">Date range</p>
            <div className="flex gap-1">
              {(["all", "today", "week", "month"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={clsx(
                    "px-2 py-1 text-[10px] font-medium rounded-md transition-colors",
                    dateRange === range ? "bg-primary/10 text-primary" : "text-text-tertiary hover:bg-surface-tertiary hover:text-text",
                  )}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-[10px] font-medium text-text-tertiary mb-1">Tags</p>
            <div className="flex flex-wrap gap-1">
              {mockTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={clsx(
                    "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors",
                    activeTags.has(tag.id)
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-surface-tertiary text-text-secondary hover:text-text",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector (static display) */}
          <div className="flex items-center h-7 px-2.5 text-xs rounded-lg border border-border bg-surface text-text">
            Claude Sonnet 4
          </div>
        </div>

        {/* Filtered results */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          <GroupLabel>This Week</GroupLabel>
          {conversations.filter((c) => c.tags?.some((t) => activeTags.has(t.id))).slice(0, 4).map((c) => (
            <ConversationItem key={c.id} conv={c} />
          ))}
        </div>

        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <NavLink icon={Settings} label="Settings" />
        </div>
      </SidebarShell>
    );
  },
};

/** Folders section expanded showing folder tree */
export const WithFolders: Story = {
  render: () => {
    const [activeFolder, setActiveFolder] = useState<string | null>("f1");

    return (
      <SidebarShell>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
          </div>
        </div>

        <nav className="px-2 pt-3 pb-2 space-y-0.5">
          <NavLink icon={MessageSquare} label="Conversations" active />
          <NavLink icon={FolderOpen} label="Folders" />
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

        {/* Folders section */}
        <div className="px-3 pt-2">
          <button className="flex items-center gap-1.5 w-full text-[10px] font-semibold uppercase tracking-widest text-text-tertiary hover:text-text-secondary transition-colors py-1">
            <ChevronDown className="h-3 w-3" />
            Folders
          </button>
          <div className="mt-1 space-y-0.5">
            {mockFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)}
                className={clsx(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                  activeFolder === folder.id
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
                )}
              >
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate flex-1 text-left">{folder.name}</span>
                <span className="text-[10px] text-text-tertiary">{folder.conversationCount}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4 mt-2" />

        <div className="px-3 pt-3 pb-1">
          <div className="relative input-glow rounded-lg">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input type="text" placeholder="Search conversations..." className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary" readOnly />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {activeFolder && (
            <div className="px-2 py-1 mb-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="primary">{mockFolders.find((f) => f.id === activeFolder)?.name}</Badge>
                <button onClick={() => setActiveFolder(null)} className="text-[10px] text-text-tertiary hover:text-text">Clear</button>
              </div>
            </div>
          )}
          <GroupLabel>Active Projects</GroupLabel>
          {conversations.slice(0, 4).map((c) => (
            <ConversationItem key={c.id} conv={c} />
          ))}
        </div>

        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <NavLink icon={Settings} label="Settings" />
        </div>
      </SidebarShell>
    );
  },
};

/** Collapsed 56px sidebar — icon-only */
export const Collapsed: Story = {
  render: () => (
    <SidebarShell collapsed>
      <div className="flex items-center justify-center py-3.5 border-b border-border">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
      </div>
      <nav className="pt-3 pb-2 px-1.5 space-y-0.5">
        <NavLink icon={MessageSquare} label="Conversations" active collapsed />
        <NavLink icon={Microscope} label="Research" collapsed />
        <NavLink icon={BookOpen} label="Knowledge" collapsed />
        <NavLink icon={Compass} label="Explore" collapsed />
        <NavLink icon={HardDrive} label="Files" collapsed />
        <NavLink icon={FolderOpen} label="Folders" collapsed />
      </nav>
      <div className="flex-1" />
      <div className="border-t border-border py-2 px-1.5 space-y-0.5">
        <NavLink icon={Settings} label="Settings" collapsed />
        <NavLink icon={HelpCircle} label="Help" collapsed />
      </div>
    </SidebarShell>
  ),
};

/** Empty state — no conversations */
export const Empty: Story = {
  render: () => (
    <SidebarShell>
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
        </div>
      </div>
      <nav className="px-2 pt-3 pb-2 space-y-0.5">
        <NavLink icon={MessageSquare} label="Conversations" active />
      </nav>
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />
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
      <div className="border-t border-border px-2 py-2 space-y-0.5">
        <NavLink icon={Settings} label="Settings" />
      </div>
    </SidebarShell>
  ),
};

/** Bulk selection mode with archive/delete actions */
export const BulkMode: Story = {
  render: () => {
    const [selected, setSelected] = useState<Set<string>>(new Set(["6", "7", "4"]));
    const groups = groupConversations(conversations);

    const toggle = (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    return (
      <SidebarShell>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text">NOVA</span>
          </div>
        </div>

        <nav className="px-2 pt-3 pb-2 space-y-0.5">
          <NavLink icon={MessageSquare} label="Conversations" active />
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

        {/* Controls with bulk mode active */}
        <div className="px-3 pt-2 flex gap-1.5">
          <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
            <Filter className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-lg bg-primary/10 text-primary transition-colors">
            <CheckSquare className="h-4 w-4" />
          </button>
        </div>

        {/* Bulk actions bar */}
        <div className="px-3 py-2 border-b border-border bg-surface-secondary flex gap-1.5">
          <button className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-border rounded-lg text-text-secondary hover:text-text transition-colors">
            <Archive className="h-3 w-3" />
            Archive ({selected.size})
          </button>
          <button className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-danger/30 rounded-lg text-danger hover:bg-danger/5 transition-colors">
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {(["pinned", "today", "yesterday", "thisWeek"] as const).map((key) => {
            const label = { pinned: "Pinned", today: "Today", yesterday: "Yesterday", thisWeek: "This Week" }[key];
            return groups[key].length > 0 ? (
              <div key={key}>
                <GroupLabel>{label}</GroupLabel>
                {groups[key].map((c) => (
                  <ConversationItem key={c.id} conv={c} bulkMode selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
                ))}
              </div>
            ) : null;
          })}
        </div>

        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <NavLink icon={Settings} label="Settings" />
        </div>
      </SidebarShell>
    );
  },
};
