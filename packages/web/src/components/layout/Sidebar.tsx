import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useMatchRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import {
  Archive, Pin, Trash2, PanelLeft, PanelLeftClose, BookOpen, Bot,
  Settings, ShieldCheck,
  HelpCircle, Filter, Search, Microscope, Compass,
  CheckSquare, Square, FolderOpen, MessageSquare, Zap, HardDrive, Plus,
  X, Loader2, ChevronRight, ChevronDown, Library,
} from "lucide-react";
import { isToday, isYesterday, isThisWeek } from "date-fns";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatRelativeTime } from "../../lib/format";
import { useUIStore } from "../../stores/ui.store";
import { useAuthStore } from "../../stores/auth.store";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { Dialog } from "../ui/Dialog";
import { ConversationListSkeleton } from "../ui/Skeleton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DateRange = "all" | "today" | "week" | "month";

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState<DateRange>("all");
  const [filterFolderId, setFilterFolderId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "chats" | "research">("all");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const matchRoute = useMatchRoute();
  const activeMatch = matchRoute({ to: "/conversations/$id", fuzzy: false });
  const activeConversationId = activeMatch ? (activeMatch as { id: string }).id : null;

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: conversationsData, isLoading: loadingConversations, isError: conversationsError, refetch: refetchConversations } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>(`/api/conversations?isArchived=false`),
    staleTime: 30_000,
  });

  const { data: researchData } = useQuery({
    queryKey: ["research-reports"],
    queryFn: () => api.get<any>("/api/research"),
    staleTime: 30_000,
  });

  const { data: foldersData } = useQuery({
    queryKey: queryKeys.folders.list(),
    queryFn: () => api.get<any>("/api/conversations/folders"),
    staleTime: 0,
    enabled: true,
  });

  const { data: folderDetailData } = useQuery({
    queryKey: queryKeys.folders.detail(filterFolderId!),
    queryFn: () => api.get<any>(`/api/conversations/folders/${filterFolderId}`),
    staleTime: 30_000,
    enabled: !!filterFolderId,
  });

  const folderConversationIds = useMemo(() => {
    if (!filterFolderId || !folderDetailData) return null;
    const convs: any[] = (folderDetailData as any)?.conversations ?? [];
    return new Set(convs.map((c: any) => c.conversationId ?? c.id));
  }, [filterFolderId, folderDetailData]);

  // ── Mutations ────────────────────────────────────────────────────────
  const bulkArchive = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => api.post(`/api/conversations/${id}/archive`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      setSelected(new Set());
      setBulkMode(false);
      toast(t("conversations.archived", { defaultValue: "Conversations archived" }), "success");
    },
    onError: () => {
      toast(t("errors.generic", { defaultValue: "Something went wrong" }), "error");
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => api.delete(`/api/conversations/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      setSelected(new Set());
      setBulkMode(false);
      toast(t("conversations.deleted", { defaultValue: "Conversations deleted" }), "success");
    },
    onError: () => {
      toast(t("errors.generic", { defaultValue: "Something went wrong" }), "error");
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────
  const rawConversations = conversationsData?.data ?? [];
  const researchReports: any[] = (researchData as any)?.data ?? [];
  const folders: any[] = (foldersData as any)?.data ?? [];

  // Merge research reports into the conversation list with a visual marker
  const conversations = useMemo(() => {
    const convs = [...rawConversations];
    for (const report of researchReports) {
      // Skip if already linked to a conversation that's in the list
      if (report.conversationId && convs.some((c: any) => c.id === report.conversationId)) continue;
      convs.push({
        id: `research-${report.id}`,
        _researchId: report.id,
        _isResearch: true,
        title: report.title || report.query,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt ?? report.createdAt,
        isPinned: false,
        isArchived: false,
        tags: [],
        _researchStatus: report.status,
      });
    }
    convs.sort((a: any, b: any) => {
      const dateA = new Date(a.updatedAt ?? a.createdAt).getTime();
      const dateB = new Date(b.updatedAt ?? b.createdAt).getTime();
      return dateB - dateA;
    });
    return convs;
  }, [rawConversations, researchReports]);

  // ── Debounced server search ──────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await api.get<any>(
          `/api/search?q=${encodeURIComponent(searchQuery)}&type=conversations&limit=20`,
        );
        setSearchResults(result?.conversations ?? result?.data ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // ── Active filter count ──────────────────────────────────────────────
  const activeFilterCount =
    (filterDateRange !== "all" ? 1 : 0) +
    (filterFolderId ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setFilterDateRange("all");
    setFilterFolderId(null);
    setFilterType("all");
  }, []);

  // ── Filtering (local for non-search, date range, tags, model) ──────
  const isSearchActive = searchQuery.trim().length >= 2;

  const filteredConversations = conversations.filter((c: any) => {
    if (filterType === "research" && !c._isResearch) return false;
    if (filterType === "chats" && c._isResearch) return false;
    if (folderConversationIds && !c._isResearch && !folderConversationIds.has(c.id)) return false;
    if (filterDateRange !== "all") {
      const date = new Date(c.updatedAt ?? c.createdAt);
      const now = new Date();
      if (filterDateRange === "today" && !isToday(date)) return false;
      if (filterDateRange === "week" && !isThisWeek(date, { weekStartsOn: 1 })) return false;
      if (filterDateRange === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 86400_000);
        if (date < monthAgo) return false;
      }
    }
    // When search is active, match conversations by title or tag name locally
    if (isSearchActive) {
      const q = searchQuery.trim().toLowerCase();
      const titleMatch = (c.title ?? "").toLowerCase().includes(q);
      const tagMatch = Array.isArray(c.tags) && c.tags.some((t: any) =>
        (t.name ?? "").toLowerCase().includes(q),
      );
      if (!titleMatch && !tagMatch) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAdmin = user?.role === "org-admin" || user?.role === "super-admin";

  // ── Group conversations by date (for non-search view) ────────────────
  const groupedConversations = (() => {
    const pinned: any[] = [];
    const today: any[] = [];
    const yesterday: any[] = [];
    const thisWeek: any[] = [];
    const older: any[] = [];

    for (const conv of filteredConversations) {
      if (conv.isPinned) {
        pinned.push(conv);
        continue;
      }
      const date = new Date(conv.updatedAt ?? conv.createdAt);
      if (isToday(date)) today.push(conv);
      else if (isYesterday(date)) yesterday.push(conv);
      else if (isThisWeek(date)) thisWeek.push(conv);
      else older.push(conv);
    }

    const groups: { label: string; conversations: any[] }[] = [];
    if (pinned.length > 0) groups.push({ label: t("conversations.pinned", { defaultValue: "Pinned" }), conversations: pinned });
    if (today.length > 0) groups.push({ label: t("conversations.today", { defaultValue: "Today" }), conversations: today });
    if (yesterday.length > 0) groups.push({ label: t("conversations.yesterday", { defaultValue: "Yesterday" }), conversations: yesterday });
    if (thisWeek.length > 0) groups.push({ label: t("conversations.thisWeek", { defaultValue: "This Week" }), conversations: thisWeek });
    if (older.length > 0) groups.push({ label: t("conversations.older", { defaultValue: "Older" }), conversations: older });
    return groups;
  })();

  return (
    <>
      <aside
        className={clsx(
          "flex flex-col h-full bg-surface-secondary border-r border-border transition-all duration-200",
          sidebarOpen ? "w-[280px]" : "w-14",
        )}
      >
        {/* Brand header */}
        <div className={clsx(
          "flex items-center border-b border-border",
          sidebarOpen ? "justify-between px-4 py-2.5" : "justify-center py-2.5",
        )}>
          {sidebarOpen ? (
            <>
              <button
                onClick={() => navigate({ to: "/" })}
                className="flex items-center gap-2.5 group"
              >
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <span className="font-bold text-sm tracking-tight text-text nova-glow">NOVA</span>
              </button>
              <button
                onClick={toggleSidebar}
                aria-label={t("nav.collapseSidebar", { defaultValue: "Collapse sidebar" })}
                className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-primary transition-colors"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              aria-label={t("nav.openSidebar", { defaultValue: "Open sidebar" })}
              className="group/logo relative h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/15 transition-colors"
              title={t("nav.openSidebar", { defaultValue: "Open sidebar" })}
            >
              <Zap className="h-4 w-4 text-primary transition-opacity group-hover/logo:opacity-0" aria-hidden="true" />
              <PanelLeft className="h-4 w-4 text-primary absolute opacity-0 transition-opacity group-hover/logo:opacity-100" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* New Chat + Library Navigation */}
        <div className={clsx("pt-2 pb-1 space-y-0.5", sidebarOpen ? "px-2" : "px-1.5")}>
          {/* + New Chat */}
          <SidebarLink icon={Plus} label={t("conversations.new", { defaultValue: "New conversation" })} to="/" exact collapsed={!sidebarOpen} />

          {/* Explore */}
          <SidebarLink icon={Compass} label={t("nav.explore", { defaultValue: "Explore" })} to="/explore" collapsed={!sidebarOpen} />

          {/* Library collapsible group */}
          <SidebarCollapsible
            icon={Library}
            label={t("nav.library", { defaultValue: "Library" })}
            collapsed={!sidebarOpen}
            routes={["/knowledge", "/files", "/agents"]}
          >
            <SidebarLink icon={BookOpen} label={t("nav.knowledge", { defaultValue: "Knowledge" })} to="/knowledge" indent />
            <SidebarLink icon={HardDrive} label={t("nav.files", { defaultValue: "Files" })} to="/files" indent />
            <SidebarLink icon={Bot} label={t("nav.agents", { defaultValue: "Agents" })} to="/agents" indent />
          </SidebarCollapsible>
        </div>

        {sidebarOpen && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

            {/* Folders Quick Access */}
            <div className="px-3 pt-1.5">
              <button
                onClick={() => setFoldersOpen(!foldersOpen)}
                className="flex items-center gap-1.5 w-full text-[10px] font-semibold uppercase tracking-widest text-text-tertiary hover:text-text-secondary transition-colors py-1"
              >
                {foldersOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {t("conversations.folders", { defaultValue: "Folders" })}
              </button>
              {foldersOpen && (
                <div className="mt-1 space-y-0.5">
                  {folders.length === 0 ? (
                    <p className="text-[10px] text-text-tertiary px-2 py-1">
                      {t("conversations.noFolders", { defaultValue: "No folders yet" })}
                    </p>
                  ) : (
                    folders.map((folder: any) => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          setFilterFolderId(filterFolderId === folder.id ? null : folder.id);
                          setShowFilters(true);
                        }}
                        className={clsx(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                          filterFolderId === folder.id
                            ? "bg-primary/10 text-primary"
                            : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
                        )}
                      >
                        <FolderOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate flex-1 text-left">{folder.name}</span>
                        {folder.conversationCount != null && (
                          <span className="text-[10px] text-text-tertiary">{folder.conversationCount}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4 mt-1.5" />

            {/* Search */}
            <div className="px-3 pt-2 pb-0.5">
              <div className="relative input-glow rounded-lg">
                {searchLoading ? (
                  <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-spin" />
                ) : (
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                )}
                <input
                  type="text"
                  placeholder={t("conversations.search", { defaultValue: "Search conversations..." })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t("conversations.search", { defaultValue: "Search conversations..." })}
                  className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text transition-colors"
                    aria-label={t("common.clear", { defaultValue: "Clear" })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isSearchActive && (
                <p className="text-[10px] text-text-tertiary mt-1 px-1">
                  {t("conversations.searchingMessages", { defaultValue: "Searching messages..." })}
                </p>
              )}
            </div>

            {/* Conversation controls */}
            <div className="px-3 pt-1 flex items-center gap-1.5">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  "relative p-1.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  showFilters ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
                )}
                aria-label={t("conversations.filter", { defaultValue: "Filter conversations" })}
                aria-pressed={showFilters}
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-white flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  bulkMode ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
                )}
                aria-label={t("conversations.bulkSelect", { defaultValue: "Bulk select" })}
                aria-pressed={bulkMode}
              >
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="ml-auto text-[10px] text-text-tertiary hover:text-primary transition-colors"
                >
                  {t("common.clearAll", { defaultValue: "Clear all" })}
                </button>
              )}
            </div>

            {/* Quick type filter chips — always visible */}
            <div className="px-3 pt-1.5 flex gap-1">
              {(["all", "chats", "research"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors",
                    filterType === type
                      ? "bg-primary/10 text-primary"
                      : "bg-surface-tertiary/50 text-text-tertiary hover:bg-surface-tertiary hover:text-text-secondary",
                  )}
                >
                  {type === "research" && <Microscope className="h-2.5 w-2.5" aria-hidden="true" />}
                  {type === "chats" && <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />}
                  {type === "all" && t("search.filter.all", { defaultValue: "All" })}
                  {type === "chats" && t("search.filter.chats", { defaultValue: "Chats" })}
                  {type === "research" && t("search.filter.research", { defaultValue: "Research" })}
                </button>
              ))}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="px-3 pt-1 space-y-1.5">
                {/* Date range toggles */}
                <div>
                  <p className="text-[10px] font-medium text-text-tertiary mb-1">{t("search.filter.dateRange", { defaultValue: "Date range" })}</p>
                  <div className="flex gap-1">
                    {(["all", "today", "week", "month"] as DateRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setFilterDateRange(range)}
                        className={clsx(
                          "px-2 py-1 text-[10px] font-medium rounded-md transition-colors",
                          filterDateRange === range
                            ? "bg-primary/10 text-primary"
                            : "text-text-tertiary hover:bg-surface-tertiary hover:text-text",
                        )}
                      >
                        {range === "all" && t("search.filter.all", { defaultValue: "All" })}
                        {range === "today" && t("search.filter.today", { defaultValue: "Today" })}
                        {range === "week" && t("search.filter.week", { defaultValue: "Week" })}
                        {range === "month" && t("search.filter.month", { defaultValue: "Month" })}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Bulk Actions */}
            {bulkMode && selected.size > 0 && (
              <div className="px-3 py-2 border-b border-border bg-surface-secondary flex gap-1.5">
                <button
                  onClick={() => bulkArchive.mutate(Array.from(selected))}
                  disabled={bulkArchive.isPending}
                  className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-border rounded-lg text-text-secondary hover:text-text disabled:opacity-50 transition-colors"
                >
                  <Archive className="h-3 w-3" aria-hidden="true" />
                  {t("common.archive", { defaultValue: "Archive" })} ({selected.size})
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkDelete.isPending}
                  className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-danger/30 rounded-lg text-danger hover:bg-danger/5 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  {t("common.delete", { defaultValue: "Delete" })}
                </button>
              </div>
            )}

            {/* Conversation List */}
            <nav aria-label={t("nav.conversations", { defaultValue: "Conversations" })} className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
              {loadingConversations && !isSearchActive ? (
                <ConversationListSkeleton />
              ) : conversationsError && !isSearchActive ? (
                <div className="px-3 py-10 text-center">
                  <MessageSquare className="h-8 w-8 text-danger mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p className="text-xs font-medium text-text-secondary">{t("conversations.loadError", "Failed to load conversations")}</p>
                  <button
                    onClick={() => refetchConversations()}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors"
                  >
                    {t("common.retry", "Retry")}
                  </button>
                </div>
              ) : isSearchActive ? (
                /* Search results — local title/tag matches + server message matches */
                (() => {
                  const localMatchIds = new Set(filteredConversations.map((c: any) => c.id));
                  const serverOnly = (searchResults ?? []).filter((r: any) => !localMatchIds.has(r.id));
                  const hasLocal = filteredConversations.length > 0;
                  const hasServer = serverOnly.length > 0;
                  const noResults = !hasLocal && !hasServer && !searchLoading;

                  return (
                    <>
                      {hasLocal && (
                        <>
                          {filteredConversations.map((conv: any) => (
                            <ConversationItem
                              key={conv.id}
                              conv={conv}
                              active={activeConversationId === conv.id}
                              onClick={() => {
                                if (conv._isResearch) {
                                  navigate({ to: "/research", search: { report: conv._researchId } });
                                } else {
                                  navigate({ to: `/conversations/${conv.id}` });
                                }
                              }}
                            />
                          ))}
                        </>
                      )}
                      {searchLoading && !hasLocal && <ConversationListSkeleton />}
                      {hasServer && (
                        <>
                          {hasLocal && (
                            <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                              {t("conversations.messageMatches", { defaultValue: "In messages" })}
                            </p>
                          )}
                          {serverOnly.map((result: any) => (
                            <button
                              key={result.id}
                              onClick={() => navigate({ to: `/conversations/${result.id}` })}
                              className={clsx(
                                "w-full flex flex-col gap-0.5 px-3 py-1.5 rounded-lg text-left transition-colors group",
                                activeConversationId === result.id
                                  ? "bg-primary/10 text-primary"
                                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
                              )}
                            >
                              <span className="text-xs truncate">{result.title ?? t("conversations.untitled", { defaultValue: "Untitled" })}</span>
                              {result.snippet && (
                                <span className="text-[10px] text-text-tertiary truncate">{result.snippet}</span>
                              )}
                              <span className="text-[10px] text-text-tertiary">
                                {result.updatedAt && formatRelativeTime(result.updatedAt)}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                      {noResults && (
                        <div className="px-3 py-10 text-center">
                          <Search className="h-8 w-8 text-text-tertiary mx-auto mb-2 opacity-30" aria-hidden="true" />
                          <p className="text-xs font-medium text-text-secondary">
                            {t("conversations.noSearchResults", { defaultValue: "No results found" })}
                          </p>
                          <p className="text-[10px] text-text-tertiary mt-1">
                            {t("conversations.tryDifferentSearch", { defaultValue: "Try a different search term" })}
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()
              ) : filteredConversations.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <MessageSquare className="h-8 w-8 text-text-tertiary mx-auto mb-2 opacity-30" aria-hidden="true" />
                  <p className="text-xs font-medium text-text-secondary">{t("conversations.empty", "No conversations yet")}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">{t("conversations.startPrompt", "Start a new conversation")}</p>
                  <button
                    onClick={() => navigate({ to: "/" })}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    {t("conversations.new", { defaultValue: "New Conversation" })}
                  </button>
                </div>
              ) : (
                groupedConversations.map((group) => (
                  <Fragment key={group.label}>
                    <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                      {group.label}
                    </p>
                    {group.conversations.map((conv: any) => (
                      <ConversationItem
                        key={conv.id}
                        conv={conv}
                        active={!bulkMode && activeConversationId === conv.id}
                        bulkMode={bulkMode}
                        selected={selected.has(conv.id)}
                        onClick={() => {
                          if (bulkMode) {
                            toggleSelect(conv.id);
                          } else if (conv._isResearch) {
                            navigate({ to: "/research", search: { report: conv._researchId } });
                          } else {
                            navigate({ to: `/conversations/${conv.id}` });
                          }
                        }}
                      />
                    ))}
                  </Fragment>
                ))
              )}
            </nav>
          </>
        )}

        {/* Spacer when collapsed to push bottom nav down */}
        {!sidebarOpen && <div className="flex-1" />}

        {/* Bottom Navigation */}
        <div className={clsx("border-t border-border py-1.5 space-y-0.5", sidebarOpen ? "px-2" : "px-1.5")}>
          <SidebarLink icon={Settings} label={t("nav.settings", "Settings")} to="/settings" collapsed={!sidebarOpen} />
          <SidebarLink icon={HelpCircle} label={t("nav.help", "Help")} to="/help" collapsed={!sidebarOpen} />
          {isAdmin && <SidebarLink icon={ShieldCheck} label={t("nav.admin", "Admin")} to="/admin" collapsed={!sidebarOpen} />}
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t("conversations.deleteConfirmTitle", { defaultValue: "Delete conversations" })}
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("conversations.deleteConfirmMessage", {
            count: selected.size,
            defaultValue: `Are you sure you want to delete ${selected.size} conversation(s)? This cannot be undone.`,
          })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={bulkDelete.isPending}
            onClick={() => {
              bulkDelete.mutate(Array.from(selected));
              setShowDeleteConfirm(false);
            }}
          >
            {t("common.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// ConversationItem — richer with metadata line
// ---------------------------------------------------------------------------

function ConversationItem({
  conv,
  active,
  bulkMode,
  selected,
  onClick,
}: {
  conv: any;
  active?: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  const relTime = conv.updatedAt
    ? formatRelativeTime(conv.updatedAt)
    : null;
  const convTags: any[] = conv.tags ?? [];

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-start gap-2 px-3 py-1.5 rounded-lg text-left transition-colors group",
        active
          ? "bg-primary/10 text-primary"
          : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
      )}
    >
      {bulkMode && (
        selected
          ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          : <Square className="h-3.5 w-3.5 text-text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
      )}
      {!bulkMode && conv._isResearch && <span title="Deep Research"><Microscope className="h-3 w-3 text-primary shrink-0 mt-1" aria-hidden="true" /></span>}
      {!bulkMode && !conv._isResearch && conv.isPinned && <Pin className="h-3 w-3 text-primary shrink-0 mt-1" aria-hidden="true" />}
      <div className="flex-1 min-w-0">
        <span className="block truncate text-xs">{conv.title ?? "Untitled"}</span>
        <span className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-tertiary">
          {conv._isResearch && (
            <>
              <span className={clsx(
                "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                conv._researchStatus === "completed" ? "bg-success" :
                conv._researchStatus === "failed" ? "bg-danger" :
                "bg-warning animate-pulse",
              )} />
            </>
          )}
          {relTime && <span>{relTime}</span>}
          {convTags.length > 0 && (
            <>
              <span aria-hidden="true">&middot;</span>
              {convTags.slice(0, 3).map((tag: any) => (
                <span
                  key={tag.id ?? tag.tagId}
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? "var(--color-text-tertiary)" }}
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

// ---------------------------------------------------------------------------
// SidebarLink
// ---------------------------------------------------------------------------

function SidebarLink({ icon: Icon, label, to, exact, collapsed, indent }: { icon: any; label: string; to: string; exact?: boolean; collapsed?: boolean; indent?: boolean }) {
  const matchRoute = useMatchRoute();
  const isActive = exact
    ? matchRoute({ to, fuzzy: false }) || (to === "/" && matchRoute({ to: "/", fuzzy: false }))
    : matchRoute({ to, fuzzy: true });

  if (collapsed) {
    return (
      <Link
        to={to}
        title={label}
        aria-current={isActive ? "page" : undefined}
        className={clsx(
          "flex items-center justify-center h-9 w-9 mx-auto rounded-lg transition-all duration-150 relative no-underline",
          isActive
            ? "bg-primary/10 text-primary nav-active"
            : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={clsx(
        "w-full flex items-center gap-2.5 py-1.5 rounded-lg text-sm transition-all duration-150 relative no-underline",
        indent ? "pl-8 pr-3" : "px-3",
        isActive
          ? "bg-primary/10 text-primary font-medium nav-active"
          : "text-text-secondary hover:bg-surface-tertiary hover:text-text hover:translate-x-0.5",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SidebarCollapsible — collapsible nav group
// ---------------------------------------------------------------------------

function SidebarCollapsible({
  icon: Icon,
  label,
  collapsed,
  children,
  routes,
}: {
  icon: any;
  label: string;
  collapsed?: boolean;
  children: React.ReactNode;
  routes: string[];
}) {
  const [open, setOpen] = useState(true);
  const matchRoute = useMatchRoute();
  const isChildActive = routes.some((r) => matchRoute({ to: r, fuzzy: true }));

  if (collapsed) {
    return (
      <div
        title={label}
        className={clsx(
          "flex items-center justify-center h-9 w-9 mx-auto rounded-lg transition-all duration-150 relative",
          isChildActive
            ? "bg-primary/10 text-primary"
            : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150",
          isChildActive
            ? "text-primary font-medium"
            : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
        <ChevronDown
          className={clsx("h-3 w-3 ml-auto transition-transform", !open && "-rotate-90")}
          aria-hidden="true"
        />
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
