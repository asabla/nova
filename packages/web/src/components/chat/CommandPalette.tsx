import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Search,
  MessageSquare,
  Bot,
  BookOpen,
  Settings,
  FolderKanban,
  Sun,
  Moon,
  Monitor,
  Plus,
  Keyboard,
  Hash,
  ArrowRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useUIStore } from "../../stores/ui.store";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { api } from "../../lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultSection = "recent" | "conversations" | "agents" | "commands" | "settings";

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  section: ResultSection;
  action: () => void;
  /** Optional keyboard shortcut hint displayed on the right */
  shortcut?: string;
}

interface ConversationResult {
  id: string;
  title: string;
}

interface AgentResult {
  id: string;
  name: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Section labels & ordering
// ---------------------------------------------------------------------------

const SECTION_LABELS: Record<ResultSection, string> = {
  recent: "Recent",
  conversations: "Conversations",
  agents: "Agents",
  commands: "Commands",
  settings: "Settings",
};

const SECTION_ORDER: ResultSection[] = [
  "recent",
  "conversations",
  "agents",
  "commands",
  "settings",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const toggle = useUIStore((s) => s.toggleCommandPalette);
  const setTheme = useUIStore((s) => s.setTheme);
  const toggleShortcutsHelp = useUIStore((s) => s.toggleShortcutsHelp);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [conversations, setConversations] = useState<ConversationResult[]>([]);
  const [agents, setAgents] = useState<AgentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ---- Toggle on Cmd+K / Ctrl+K ----
  useKeyboardShortcuts([
    { key: "k", meta: true, handler: () => toggle() },
  ]);

  // ---- Close helper ----
  const close = useCallback(() => setOpen(false), [setOpen]);

  const runAndClose = useCallback(
    (fn: () => void) => () => {
      fn();
      close();
    },
    [close],
  );

  // ---- Fetch recent conversations & agents when opening ----
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);

    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      api.get<{ data: ConversationResult[] }>("/api/conversations?limit=5&sort=-updatedAt"),
      api.get<{ data: AgentResult[] }>("/api/agents?limit=5"),
    ]).then(([convResult, agentResult]) => {
      if (cancelled) return;
      if (convResult.status === "fulfilled" && convResult.value?.data) {
        setConversations(convResult.value.data);
      }
      if (agentResult.status === "fulfilled" && agentResult.value?.data) {
        setAgents(agentResult.value.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // ---- Static command items ----
  const staticCommands: PaletteItem[] = useMemo(
    () => [
      // Quick actions (commands)
      {
        id: "cmd-new-chat",
        label: "New Chat",
        icon: <Plus className="h-4 w-4" />,
        section: "commands",
        action: runAndClose(() => navigate({ to: "/conversations/new" })),
        shortcut: "\u2318N",
      },
      {
        id: "cmd-new-agent",
        label: "New Agent",
        icon: <Bot className="h-4 w-4" />,
        section: "commands",
        action: runAndClose(() => navigate({ to: "/agents/new" })),
      },
      {
        id: "cmd-search",
        label: "Search Conversations",
        icon: <Search className="h-4 w-4" />,
        section: "commands",
        action: runAndClose(() => navigate({ to: "/search" as any })),
        shortcut: "\u2318\u21E7F",
      },
      {
        id: "cmd-shortcuts",
        label: "Keyboard Shortcuts",
        icon: <Keyboard className="h-4 w-4" />,
        section: "commands",
        action: runAndClose(() => toggleShortcutsHelp()),
        shortcut: "\u2318/",
      },
      {
        id: "cmd-toggle-sidebar",
        label: "Toggle Sidebar",
        icon: <ArrowRight className="h-4 w-4" />,
        section: "commands",
        action: runAndClose(() => toggleSidebar()),
        shortcut: "\u2318B",
      },

      // Navigation / Settings
      {
        id: "nav-agents",
        label: "Agents",
        icon: <Bot className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => navigate({ to: "/agents" })),
      },
      {
        id: "nav-knowledge",
        label: "Knowledge Base",
        icon: <BookOpen className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => navigate({ to: "/knowledge" })),
      },
      {
        id: "nav-workspaces",
        label: "Workspaces",
        icon: <FolderKanban className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => navigate({ to: "/workspaces" })),
      },
      {
        id: "nav-settings",
        label: t("app.settings"),
        icon: <Settings className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => navigate({ to: "/settings/profile" })),
        shortcut: "\u2318,",
      },

      // Theme
      {
        id: "theme-light",
        label: "Light Mode",
        icon: <Sun className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => setTheme("light")),
      },
      {
        id: "theme-dark",
        label: "Dark Mode",
        icon: <Moon className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => setTheme("dark")),
      },
      {
        id: "theme-system",
        label: "System Theme",
        icon: <Monitor className="h-4 w-4" />,
        section: "settings",
        action: runAndClose(() => setTheme("system")),
      },
    ],
    [t, navigate, setTheme, runAndClose, toggleShortcutsHelp, toggleSidebar],
  );

  // ---- Dynamic items from fetched data ----
  const dynamicItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    for (const conv of conversations) {
      items.push({
        id: `conv-${conv.id}`,
        label: conv.title || "Untitled Conversation",
        icon: <MessageSquare className="h-4 w-4" />,
        section: query ? "conversations" : "recent",
        action: runAndClose(() => navigate({ to: "/conversations/$id", params: { id: conv.id } })),
      });
    }

    for (const agent of agents) {
      items.push({
        id: `agent-${agent.id}`,
        label: agent.name,
        description: agent.description,
        icon: <Bot className="h-4 w-4" />,
        section: query ? "agents" : "recent",
        action: runAndClose(() => navigate({ to: "/agents/$id", params: { id: agent.id } })),
      });
    }

    return items;
  }, [conversations, agents, query, navigate, runAndClose]);

  // ---- Merge & filter ----
  const allItems = useMemo(
    () => [...dynamicItems, ...staticCommands],
    [dynamicItems, staticCommands],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q),
    );
  }, [query, allItems]);

  // ---- Group by section ----
  const grouped = useMemo(() => {
    const map = new Map<ResultSection, PaletteItem[]>();
    for (const item of filtered) {
      if (!map.has(item.section)) {
        map.set(item.section, []);
      }
      map.get(item.section)!.push(item);
    }
    return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({
      section: s,
      label: SECTION_LABELS[s],
      items: map.get(s)!,
    }));
  }, [filtered]);

  // Flat list for keyboard navigation indexing
  const flatItems = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped],
  );

  // ---- Reset selection on query change ----
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ---- Scroll selected item into view ----
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ---- Keyboard navigation ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            flatItems[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "Tab":
          // Prevent focus from leaving the palette
          e.preventDefault();
          break;
      }
    },
    [flatItems, selectedIndex, close],
  );

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      {/* Palette container */}
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-150">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations, agents, commands..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
            aria-label="Command palette search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={
              flatItems[selectedIndex]
                ? `palette-item-${flatItems[selectedIndex].id}`
                : undefined
            }
          />
          <kbd className="text-[10px] text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-[360px] overflow-y-auto py-1"
        >
          {loading && flatItems.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-text-tertiary">
              Loading...
            </div>
          )}

          {!loading && flatItems.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-text-tertiary">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {grouped.map((group) => {
            const groupStart = runningIndex;
            const groupEl = (
              <div key={group.section}>
                {/* Section header */}
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {group.label}
                </div>

                {group.items.map((item) => {
                  const idx = runningIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      id={`palette-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "text-text-secondary hover:bg-surface-secondary",
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-[10px] text-text-tertiary">
                            {item.description}
                          </span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="ml-auto shrink-0 text-[10px] text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded border border-border">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
            return groupEl;
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-tertiary px-1 py-0.5 rounded border border-border">&uarr;&darr;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-tertiary px-1 py-0.5 rounded border border-border">&crarr;</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-tertiary px-1 py-0.5 rounded border border-border">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
