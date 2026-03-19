import { Fragment, useState } from "react";
import { useNavigate, useMatchRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import {
  Archive, Pin, Trash2, PanelLeft, PanelLeftClose, BookOpen,
  FolderKanban, Settings, ShieldCheck,
  Microscope, Compass, HelpCircle, Filter, Search,
  CheckSquare, Square, FolderOpen, MessageSquare, Zap, HardDrive, Plus,
} from "lucide-react";
import { isToday, isYesterday, isThisWeek } from "date-fns";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Select } from "../ui/Select";
import { useUIStore } from "../../stores/ui.store";
import { useAuthStore } from "../../stores/auth.store";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { Dialog } from "../ui/Dialog";
import { ConversationListSkeleton } from "../ui/Skeleton";

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const [showFilters, setShowFilters] = useState(false);
  const [filterWorkspace, setFilterWorkspace] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const matchRoute = useMatchRoute();
  const activeMatch = matchRoute({ to: "/conversations/$id", fuzzy: false });
  const activeConversationId = activeMatch ? (activeMatch as { id: string }).id : null;

  const { data: conversationsData, isLoading: loadingConversations, isError: conversationsError, refetch: refetchConversations } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>(`/api/conversations?isArchived=false`),
    staleTime: 30_000,
  });

  const { data: workspacesData } = useQuery({
    queryKey: queryKeys.workspaces.all,
    queryFn: () => api.get<any>("/api/workspaces"),
    staleTime: 60_000,
  });

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

  const conversations = conversationsData?.data ?? [];
  const workspaces = (workspacesData as any)?.data ?? [];

  const filteredConversations = conversations.filter((c: any) => {
    if (filterWorkspace && c.workspaceId !== filterWorkspace) return false;
    if (searchQuery && !(c.title ?? "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
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

  // Group conversations by date sections (matching ConversationList story)
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
          sidebarOpen ? "justify-between px-4 py-3.5" : "justify-center py-3.5",
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

        {/* Primary Navigation */}
        <nav className={clsx("pt-3 pb-2 space-y-0.5", sidebarOpen ? "px-2" : "px-1.5")} aria-label={t("nav.main", { defaultValue: "Main navigation" })}>
          <SidebarLink icon={MessageSquare} label={t("nav.conversations", { defaultValue: "Conversations" })} to="/" exact collapsed={!sidebarOpen} />
          <SidebarLink icon={Microscope} label={t("nav.research", { defaultValue: "Research" })} to="/research" collapsed={!sidebarOpen} />
          <SidebarLink icon={BookOpen} label={t("nav.knowledge", { defaultValue: "Knowledge" })} to="/knowledge" collapsed={!sidebarOpen} />
          <SidebarLink icon={Compass} label={t("nav.explore", { defaultValue: "Explore" })} to="/explore" collapsed={!sidebarOpen} />
          <SidebarLink icon={FolderKanban} label={t("nav.workspaces", { defaultValue: "Workspaces" })} to="/workspaces" collapsed={!sidebarOpen} />
          <SidebarLink icon={HardDrive} label={t("nav.files", { defaultValue: "Files" })} to="/files" collapsed={!sidebarOpen} />
        </nav>

        {sidebarOpen && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

            {/* Search */}
            <div className="px-3 pt-3 pb-1">
              <div className="relative input-glow rounded-lg">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                <input
                  type="text"
                  placeholder={t("conversations.search", { defaultValue: "Search conversations..." })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={t("conversations.search", { defaultValue: "Search conversations..." })}
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary"
                />
              </div>
            </div>

            {/* Conversation controls */}
            <div className="px-3 pt-3 flex gap-1.5">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  showFilters ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
                )}
                aria-label={t("conversations.filter", { defaultValue: "Filter conversations" })}
                aria-pressed={showFilters}
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
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
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="px-3 pt-2 space-y-1.5">
                {workspaces.length > 0 && (
                  <Select
                    value={filterWorkspace}
                    onChange={(value) => setFilterWorkspace(value)}
                    placeholder={t("search.filter.allWorkspaces", { defaultValue: "All workspaces" })}
                    options={[
                      { value: "", label: t("search.filter.allWorkspaces", { defaultValue: "All workspaces" }) },
                      ...workspaces.map((w: any) => ({ value: w.id, label: w.name })),
                    ]}
                    size="sm"
                  />
                )}
              </div>
            )}

            {/* Bulk Actions — styled bar matching ConversationList story */}
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

            {/* Conversation List — date-grouped matching ConversationList story */}
            <nav aria-label={t("nav.conversations", { defaultValue: "Conversations" })} className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
              {loadingConversations ? (
                <ConversationListSkeleton />
              ) : conversationsError ? (
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
                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                      {group.label}
                    </p>
                    {group.conversations.map((conv: any) => (
                      <button
                        key={conv.id}
                        onClick={() => {
                          if (bulkMode) {
                            toggleSelect(conv.id);
                          } else {
                            navigate({ to: `/conversations/${conv.id}` });
                          }
                        }}
                        className={clsx(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors group",
                          !bulkMode && activeConversationId === conv.id
                            ? "bg-primary/10 text-primary"
                            : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
                        )}
                      >
                        {bulkMode && (
                          selected.has(conv.id)
                            ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                            : <Square className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                        )}
                        {!bulkMode && conv.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />}
                        <span className="truncate flex-1">{conv.title ?? t("conversations.untitled", { defaultValue: "Untitled" })}</span>
                        {conv.workspaceId && <FolderOpen className="h-3 w-3 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />}
                      </button>
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
        <div className={clsx("border-t border-border py-2 space-y-0.5", sidebarOpen ? "px-2" : "px-1.5")}>
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

function SidebarLink({ icon: Icon, label, to, exact, collapsed }: { icon: any; label: string; to: string; exact?: boolean; collapsed?: boolean }) {
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
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 relative no-underline",
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
