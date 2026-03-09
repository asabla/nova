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
  ArrowRight,
  FileText,
  Compass,
  Microscope,
  HelpCircle,
  BarChart3,
  ShieldCheck,
  Hash,
  FlaskConical,
} from "lucide-react";
import { clsx } from "clsx";
import { useUIStore } from "../../stores/ui.store";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth.store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultSection =
  | "quick-actions"
  | "recent"
  | "conversations"
  | "messages"
  | "agents"
  | "knowledge"
  | "workspaces"
  | "research"
  | "navigation"
  | "settings";

interface OmniItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  section: ResultSection;
  action: () => void;
  shortcut?: string;
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const modKey = isMac ? "\u2318" : "Ctrl+";
const shiftKey = isMac ? "\u21E7" : "Shift+";

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

const SECTION_ORDER: ResultSection[] = [
  "quick-actions",
  "recent",
  "conversations",
  "messages",
  "agents",
  "knowledge",
  "workspaces",
  "research",
  "navigation",
  "settings",
];

const SECTION_COLORS: Record<ResultSection, string> = {
  "quick-actions": "border-l-primary",
  recent: "border-l-accent-muted",
  conversations: "border-l-blue-400",
  messages: "border-l-sky-400",
  agents: "border-l-violet-400",
  knowledge: "border-l-emerald-400",
  workspaces: "border-l-amber-400",
  research: "border-l-rose-400",
  navigation: "border-l-text-tertiary",
  settings: "border-l-text-tertiary",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OmniBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useUIStore((s) => s.omniBarOpen);
  const setOpen = useUIStore((s) => s.setOmniBarOpen);
  const setTheme = useUIStore((s) => s.setTheme);
  const toggleShortcutsHelp = useUIStore((s) => s.toggleShortcutsHelp);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "org-admin" || user?.role === "admin";

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [recentAgents, setRecentAgents] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const SECTION_LABELS: Record<ResultSection, string> = useMemo(
    () => ({
      "quick-actions": t("omnibar.quickActions", { defaultValue: "Quick Actions" }),
      recent: t("omnibar.recent", { defaultValue: "Recent" }),
      conversations: t("omnibar.conversations", { defaultValue: "Conversations" }),
      messages: t("omnibar.messages", { defaultValue: "Messages" }),
      agents: t("omnibar.agents", { defaultValue: "Agents" }),
      knowledge: t("omnibar.knowledge", { defaultValue: "Knowledge" }),
      workspaces: t("omnibar.workspaces", { defaultValue: "Workspaces" }),
      research: t("omnibar.research", { defaultValue: "Research" }),
      navigation: t("omnibar.navigation", { defaultValue: "Go to" }),
      settings: t("omnibar.settings", { defaultValue: "Settings & Theme" }),
    }),
    [t],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSearchResults(null);
  }, [setOpen]);

  const runAndClose = useCallback(
    (fn: () => void) => () => {
      fn();
      close();
    },
    [close],
  );

  // Open: focus input, load recents
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    setSearchResults(null);
    setTimeout(() => inputRef.current?.focus(), 0);

    let cancelled = false;
    Promise.allSettled([
      api.get<{ data: any[] }>("/api/conversations?limit=5&sort=-updatedAt&isArchived=false"),
      api.get<{ data: any[] }>("/api/agents?limit=5"),
    ]).then(([convResult, agentResult]) => {
      if (cancelled) return;
      if (convResult.status === "fulfilled" && convResult.value?.data) {
        setRecentConversations(convResult.value.data);
      }
      if (agentResult.status === "fulfilled" && agentResult.value?.data) {
        setRecentAgents(agentResult.value.data);
      }
    });

    return () => { cancelled = true; };
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults(null);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await api.get<any>(
          `/api/search?q=${encodeURIComponent(query)}&type=all&limit=8`,
        );
        setSearchResults(result);
      } catch {
        setSearchResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, close]);

  // ---- Static commands ----
  const staticCommands: OmniItem[] = useMemo(
    () => [
      {
        id: "qa-new-chat",
        label: t("omnibar.newChat", { defaultValue: "New Conversation" }),
        icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        section: "quick-actions" as ResultSection,
        action: runAndClose(() => navigate({ to: "/conversations/new" })),
        shortcut: `${modKey}N`,
      },
      {
        id: "qa-new-agent",
        label: t("omnibar.newAgent", { defaultValue: "Create Agent" }),
        icon: <Bot className="h-4 w-4" aria-hidden="true" />,
        section: "quick-actions" as ResultSection,
        action: runAndClose(() => navigate({ to: "/agents/new" })),
      },
      {
        id: "qa-shortcuts",
        label: t("omnibar.keyboardShortcuts", { defaultValue: "Keyboard Shortcuts" }),
        icon: <Keyboard className="h-4 w-4" aria-hidden="true" />,
        section: "quick-actions" as ResultSection,
        action: runAndClose(() => toggleShortcutsHelp()),
        shortcut: `${modKey}/`,
      },
      {
        id: "qa-toggle-sidebar",
        label: t("omnibar.toggleSidebar", { defaultValue: "Toggle Sidebar" }),
        icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
        section: "quick-actions" as ResultSection,
        action: runAndClose(() => toggleSidebar()),
        shortcut: `${modKey}B`,
      },
      // Navigation
      {
        id: "nav-conversations",
        label: t("nav.conversations", { defaultValue: "Conversations" }),
        icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/" })),
      },
      {
        id: "nav-agents",
        label: t("nav.agents", { defaultValue: "Agents" }),
        icon: <Bot className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/agents" })),
      },
      {
        id: "nav-knowledge",
        label: t("nav.knowledge", { defaultValue: "Knowledge" }),
        icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/knowledge" })),
      },
      {
        id: "nav-research",
        label: t("nav.research", { defaultValue: "Research" }),
        icon: <Microscope className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/research" })),
      },
      {
        id: "nav-explore",
        label: t("nav.explore", { defaultValue: "Explore" }),
        icon: <Compass className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/explore" })),
      },
      {
        id: "nav-workspaces",
        label: t("nav.workspaces", { defaultValue: "Workspaces" }),
        icon: <FolderKanban className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/workspaces" })),
      },
      {
        id: "nav-help",
        label: t("nav.help", { defaultValue: "Help" }),
        icon: <HelpCircle className="h-4 w-4" aria-hidden="true" />,
        section: "navigation" as ResultSection,
        action: runAndClose(() => navigate({ to: "/help" })),
      },
      ...(isAdmin
        ? [{
            id: "nav-admin",
            label: t("nav.admin", { defaultValue: "Administration" }),
            icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
            section: "navigation" as ResultSection,
            action: runAndClose(() => navigate({ to: "/admin" })),
          }]
        : []),
      // Settings
      {
        id: "nav-settings",
        label: t("nav.settings", { defaultValue: "Settings" }),
        icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        section: "settings" as ResultSection,
        action: runAndClose(() => navigate({ to: "/settings/profile" })),
        shortcut: `${modKey},`,
      },
      {
        id: "nav-usage",
        label: t("nav.usage", { defaultValue: "Usage & Billing" }),
        icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
        section: "settings" as ResultSection,
        action: runAndClose(() => navigate({ to: "/usage" })),
      },
      {
        id: "theme-light",
        label: t("omnibar.lightMode", { defaultValue: "Switch to Light Mode" }),
        icon: <Sun className="h-4 w-4" aria-hidden="true" />,
        section: "settings" as ResultSection,
        action: runAndClose(() => setTheme("light")),
      },
      {
        id: "theme-dark",
        label: t("omnibar.darkMode", { defaultValue: "Switch to Dark Mode" }),
        icon: <Moon className="h-4 w-4" aria-hidden="true" />,
        section: "settings" as ResultSection,
        action: runAndClose(() => setTheme("dark")),
      },
      {
        id: "theme-system",
        label: t("omnibar.systemTheme", { defaultValue: "Use System Theme" }),
        icon: <Monitor className="h-4 w-4" aria-hidden="true" />,
        section: "settings" as ResultSection,
        action: runAndClose(() => setTheme("system")),
      },
    ],
    [t, navigate, setTheme, runAndClose, toggleShortcutsHelp, toggleSidebar, isAdmin],
  );

  // ---- Build items list ----
  const allItems = useMemo(() => {
    const items: OmniItem[] = [];
    const hasSearch = query.trim().length >= 2;

    if (!hasSearch) {
      for (const conv of recentConversations) {
        items.push({
          id: `recent-conv-${conv.id}`,
          label: conv.title || t("omnibar.untitled", { defaultValue: "Untitled Conversation" }),
          icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
          section: "recent",
          action: runAndClose(() => navigate({ to: "/conversations/$id", params: { id: conv.id } })),
        });
      }
      for (const agent of recentAgents) {
        items.push({
          id: `recent-agent-${agent.id}`,
          label: agent.name,
          description: agent.description,
          icon: <Bot className="h-4 w-4" aria-hidden="true" />,
          section: "recent",
          action: runAndClose(() => navigate({ to: "/agents/$id", params: { id: agent.id } })),
        });
      }
    }

    if (hasSearch && searchResults) {
      const sr = searchResults as any;

      // Conversations
      for (const r of sr.conversations ?? []) {
        items.push({
          id: `search-conv-${r.id}`,
          label: r.title || t("omnibar.untitled", { defaultValue: "Untitled Conversation" }),
          icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
          section: "conversations",
          action: runAndClose(() => navigate({ to: "/conversations/$id", params: { id: r.id } })),
        });
      }

      // Messages
      for (const r of sr.messages ?? []) {
        items.push({
          id: `search-msg-${r.id}`,
          label: r.snippet || r.content?.slice(0, 80) || "Message",
          icon: <Hash className="h-4 w-4" aria-hidden="true" />,
          section: "messages",
          action: runAndClose(() => navigate({ to: "/conversations/$id", params: { id: r.conversationId } })),
        });
      }

      // Agents
      for (const r of sr.agents ?? []) {
        items.push({
          id: `search-agent-${r.id}`,
          label: r.name,
          description: r.snippet || r.description,
          icon: <Bot className="h-4 w-4" aria-hidden="true" />,
          section: "agents",
          action: runAndClose(() => navigate({ to: "/agents/$id", params: { id: r.id } })),
        });
      }

      // Knowledge collections
      for (const r of sr.knowledge ?? []) {
        items.push({
          id: `search-kb-${r.id}`,
          label: r.name,
          description: r.snippet || r.description,
          icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
          section: "knowledge",
          action: runAndClose(() => navigate({ to: "/knowledge/$id", params: { id: r.id } })),
        });
      }

      // Files
      for (const r of sr.files ?? []) {
        items.push({
          id: `search-file-${r.id}`,
          label: r.filename,
          icon: <FileText className="h-4 w-4" aria-hidden="true" />,
          section: "knowledge",
          action: runAndClose(() => navigate({ to: "/knowledge" })),
        });
      }

      // Workspaces
      for (const r of sr.workspaces ?? []) {
        items.push({
          id: `search-ws-${r.id}`,
          label: r.name,
          description: r.snippet || r.description,
          icon: <FolderKanban className="h-4 w-4" aria-hidden="true" />,
          section: "workspaces",
          action: runAndClose(() => navigate({ to: "/workspaces/$id", params: { id: r.id } })),
        });
      }

      // Research reports
      for (const r of sr.research ?? []) {
        items.push({
          id: `search-research-${r.id}`,
          label: r.title || r.query,
          description: r.status,
          icon: <FlaskConical className="h-4 w-4" aria-hidden="true" />,
          section: "research",
          action: runAndClose(() => navigate({ to: "/research" })),
        });
      }
    }

    const commandsToAdd = hasSearch
      ? staticCommands.filter(
          (cmd) =>
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(query.toLowerCase()),
        )
      : staticCommands.filter((cmd) => cmd.section === "quick-actions");

    items.push(...commandsToAdd);
    return items;
  }, [query, recentConversations, recentAgents, searchResults, staticCommands, navigate, runAndClose, t]);

  const grouped = useMemo(() => {
    const map = new Map<ResultSection, OmniItem[]>();
    for (const item of allItems) {
      if (!map.has(item.section)) map.set(item.section, []);
      map.get(item.section)!.push(item);
    }
    return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({
      section: s,
      label: SECTION_LABELS[s],
      items: map.get(s)!,
    }));
  }, [allItems, SECTION_LABELS]);

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

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
          if (flatItems[selectedIndex]) flatItems[selectedIndex].action();
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "Tab":
          e.preventDefault();
          break;
      }
    },
    [flatItems, selectedIndex, close],
  );

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div ref={dropdownRef} className="relative w-full max-w-2xl mx-auto" role="dialog" aria-modal="true" aria-label={t("omnibar.title", { defaultValue: "Universal search" })}>
      {/* Frosted backdrop */}
      <div className="fixed inset-0 z-40 omni-backdrop" onClick={close} />

      <div className="relative z-50">
        {/* Search input — signature glow */}
        <div className="flex items-center gap-2.5 h-11 px-4 rounded-2xl bg-surface border border-border-strong shadow-lg input-glow transition-shadow">
          <Search
            className={clsx(
              "h-4 w-4 shrink-0 transition-colors duration-150",
              query ? "text-primary" : "text-text-tertiary",
            )}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("omnibar.placeholder", {
              defaultValue: "Search conversations, knowledge, workspaces, commands...",
            })}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
            aria-label={t("omnibar.label", { defaultValue: "Universal search" })}
            role="combobox"
            aria-expanded="true"
            aria-controls="omnibar-list"
            aria-activedescendant={
              flatItems[selectedIndex] ? `omni-item-${flatItems[selectedIndex].id}` : undefined
            }
          />
          {loading && (
            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
          <kbd className="text-[10px] text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded-md border border-border font-mono">
            ESC
          </kbd>
        </div>

        {/* Dropdown results */}
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in scale-in duration-150 z-50">
          <div
            ref={listRef}
            id="omnibar-list"
            role="listbox"
            className="max-h-[420px] overflow-y-auto py-1.5"
          >
            {flatItems.length === 0 && query.length >= 2 && !loading && (
              <div className="px-5 py-10 text-center">
                <Search className="h-10 w-10 text-text-tertiary mx-auto mb-3 opacity-30" />
                <p className="text-sm text-text-secondary font-medium">
                  {t("omnibar.noResults", { defaultValue: "No results found for" })}{" "}
                  &ldquo;{query}&rdquo;
                </p>
                <p className="text-xs text-text-tertiary mt-1.5">
                  {t("omnibar.tryDifferent", { defaultValue: "Try a different search term" })}
                </p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.section} role="group" aria-label={group.label} className={clsx("border-l-2 ml-3 mb-1", SECTION_COLORS[group.section])}>
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const idx = runningIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      id={`omni-item-${item.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={clsx(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-all duration-100 rounded-lg mr-2",
                        isSelected
                          ? "bg-primary/12 text-text"
                          : "text-text-secondary hover:bg-surface-secondary",
                      )}
                    >
                      <span
                        className={clsx(
                          "shrink-0 transition-colors duration-100",
                          isSelected ? "text-primary" : "",
                        )}
                      >
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={clsx("block truncate", isSelected && "font-medium")}>{item.label}</span>
                        {item.description && (
                          <span className="block truncate text-xs text-text-tertiary mt-0.5">
                            {item.description}
                          </span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="ml-auto shrink-0 text-[10px] text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded-md border border-border font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[10px] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface-tertiary px-1 py-0.5 rounded-md border border-border font-mono">&uarr;&darr;</kbd>
              {t("omnibar.navigate", { defaultValue: "Navigate" })}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface-tertiary px-1 py-0.5 rounded-md border border-border font-mono">&crarr;</kbd>
              {t("omnibar.select", { defaultValue: "Select" })}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-surface-tertiary px-1 py-0.5 rounded-md border border-border font-mono">Esc</kbd>
              {t("omnibar.close", { defaultValue: "Close" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The always-visible search trigger in the header.
 * Clicking it or pressing Cmd+K opens the full OmniBar dropdown.
 */
export function OmniBarTrigger() {
  const { t } = useTranslation();
  const setOpen = useUIStore((s) => s.setOmniBarOpen);
  const isOpen = useUIStore((s) => s.omniBarOpen);

  if (isOpen) return <OmniBar />;

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2.5 h-10 w-full max-w-2xl mx-auto px-4 rounded-xl bg-surface-secondary/60 border border-border text-sm text-text-tertiary hover:text-text-secondary hover:border-border-strong hover:bg-surface-secondary hover:shadow-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-left truncate">
        {t("omnibar.placeholder", {
          defaultValue: "Search conversations, knowledge, workspaces, commands...",
        })}
      </span>
      <kbd className="hidden sm:inline text-[10px] font-mono bg-surface-tertiary/80 px-1.5 py-0.5 rounded-md border border-border text-text-tertiary">
        {isMac ? "\u2318" : "Ctrl+"}K
      </kbd>
    </button>
  );
}
