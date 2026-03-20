import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  Search, MessageSquare, Bot, BookOpen, Plus, Keyboard,
  ArrowRight, Settings, Sun, Moon, Monitor, Hash,
  Microscope, Compass, BarChart3, HelpCircle,
} from "lucide-react";

const meta: Meta = {
  title: "Layout/OmniBar",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

// ── Mock data ────────────────────────────────────────────────────────────

const now = new Date();
const hours = (h: number) => new Date(now.getTime() - h * 3600_000);
const days = (d: number) => new Date(now.getTime() - d * 86400_000);

function formatRelativeTime(date: Date) {
  const diff = now.getTime() - date.getTime();
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86400_000)}d ago`;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const modKey = isMac ? "\u2318" : "Ctrl+";

type ResultSection = "quick-actions" | "recent" | "conversations" | "messages" | "navigation" | "settings";

interface OmniItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  section: ResultSection;
  shortcut?: string;
}

const SECTION_COLORS: Record<ResultSection, string> = {
  "quick-actions": "border-l-primary",
  recent: "border-l-accent-muted",
  conversations: "border-l-blue-400",
  messages: "border-l-sky-400",
  navigation: "border-l-text-tertiary",
  settings: "border-l-text-tertiary",
};

// ── Shared rendering ─────────────────────────────────────────────────────

function OmniBarShell({
  query,
  onQueryChange,
  loading,
  groups,
  selectedIndex,
  footer,
  placeholder,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  loading?: boolean;
  groups: { section: ResultSection; label: string; items: OmniItem[] }[];
  selectedIndex: number;
  footer?: React.ReactNode;
  placeholder?: string;
}) {
  let runningIndex = 0;
  const flatItems = groups.flatMap((g) => g.items);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input */}
      <div className="flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-surface border border-border-strong shadow-lg input-glow">
        <Search
          className={clsx("h-4 w-4 shrink-0 transition-colors", query ? "text-primary" : "text-text-tertiary")}
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder ?? "Search conversations, knowledge, agents, commands..."}
          className="flex-1 bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
          readOnly
        />
        {loading && (
          <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
        <kbd className="text-[10px] text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded-md border border-border font-mono">ESC</kbd>
      </div>

      {/* Dropdown */}
      <div className="mt-2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto py-1.5">
          {flatItems.length === 0 && query.length >= 2 && !loading && (
            <div className="px-5 py-10 text-center">
              <Search className="h-10 w-10 text-text-tertiary mx-auto mb-3 opacity-30" />
              <p className="text-sm text-text-secondary font-medium">
                No results found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-text-tertiary mt-1.5">Try a different search term</p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.section} className={clsx("border-l-2 ml-3 mb-1", SECTION_COLORS[group.section])}>
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                {group.label}
              </div>
              {group.items.map((item) => {
                const idx = runningIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg mr-2 transition-all duration-100",
                      isSelected ? "bg-primary/12 text-text" : "text-text-secondary",
                    )}
                  >
                    <span className={clsx("shrink-0", isSelected && "text-primary")}>{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={clsx("block truncate", isSelected && "font-medium")}>{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-text-tertiary mt-0.5">{item.description}</span>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="ml-auto shrink-0 text-[10px] text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded-md border border-border font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <kbd className="bg-surface-tertiary px-1 py-0.5 rounded-md border border-border font-mono">&uarr;&darr;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="bg-surface-tertiary px-1 py-0.5 rounded-md border border-border font-mono">&crarr;</kbd>
            Select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="bg-surface-tertiary px-1 py-0.5 rounded-md border border-border font-mono">Esc</kbd>
            Close
          </span>
          {footer}
        </div>
      </div>
    </div>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Default state — recent items and quick actions */
export const Default: Story = {
  render: () => {
    const recentItems: OmniItem[] = [
      { id: "r1", label: "Project Architecture Overview", description: "1h ago", icon: <MessageSquare className="h-4 w-4" />, section: "recent" },
      { id: "r2", label: "How to implement RAG with embeddings", description: "30m ago", icon: <MessageSquare className="h-4 w-4" />, section: "recent" },
      { id: "r3", label: "Debug WebSocket reconnection issue", description: "2h ago", icon: <MessageSquare className="h-4 w-4" />, section: "recent" },
      { id: "r4", label: "Code Reviewer", description: "Custom review agent", icon: <Bot className="h-4 w-4" />, section: "recent" },
    ];
    const quickActions: OmniItem[] = [
      { id: "qa1", label: "New Conversation", icon: <Plus className="h-4 w-4" />, section: "quick-actions", shortcut: `${modKey}N` },
      { id: "qa2", label: "Create Agent", icon: <Bot className="h-4 w-4" />, section: "quick-actions" },
      { id: "qa3", label: "Keyboard Shortcuts", icon: <Keyboard className="h-4 w-4" />, section: "quick-actions", shortcut: `${modKey}/` },
      { id: "qa4", label: "Toggle Sidebar", icon: <ArrowRight className="h-4 w-4" />, section: "quick-actions", shortcut: `${modKey}B` },
    ];

    return (
      <OmniBarShell
        query=""
        onQueryChange={() => {}}
        groups={[
          { section: "recent", label: "Recent", items: recentItems },
          { section: "quick-actions", label: "Quick Actions", items: quickActions },
        ]}
        selectedIndex={0}
      />
    );
  },
};

/** Search results with conversation snippets and relative times */
export const SearchResults: Story = {
  render: () => {
    const conversationResults: OmniItem[] = [
      { id: "c1", label: "How to implement RAG with embeddings", description: "...using vector embeddings to retrieve relevant documents... · 30m ago", icon: <MessageSquare className="h-4 w-4" />, section: "conversations" },
      { id: "c2", label: "Compare vector databases", description: "...Pinecone vs Qdrant vs pgvector performance... · 3d ago", icon: <MessageSquare className="h-4 w-4" />, section: "conversations" },
    ];
    const messageResults: OmniItem[] = [
      { id: "m1", label: "...the embedding dimension should match your model's output size...", icon: <Hash className="h-4 w-4" />, section: "messages" },
      { id: "m2", label: "...pgvector supports HNSW indexing for approximate nearest neighbor...", icon: <Hash className="h-4 w-4" />, section: "messages" },
    ];
    const navResults: OmniItem[] = [
      { id: "n1", label: "Knowledge", icon: <BookOpen className="h-4 w-4" />, section: "navigation" },
    ];

    return (
      <OmniBarShell
        query="vector embeddings"
        onQueryChange={() => {}}
        groups={[
          { section: "conversations", label: "Conversations", items: conversationResults },
          { section: "messages", label: "Messages", items: messageResults },
          { section: "navigation", label: "Go to", items: navResults },
        ]}
        selectedIndex={0}
      />
    );
  },
};

/** No results empty state */
export const NoResults: Story = {
  render: () => (
    <OmniBarShell
      query="xyznonexistent"
      onQueryChange={() => {}}
      groups={[]}
      selectedIndex={0}
    />
  ),
};
