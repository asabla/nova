import { useState } from "react";
import { useNavigate, useMatchRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import {
  Archive, Pin, Trash2, ChevronLeft, BookOpen,
  FolderKanban, Settings, ShieldCheck,
  Microscope, Compass, HelpCircle, Filter,
  CheckSquare, Square, FolderOpen, MessageSquare, Zap, HardDrive,
} from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
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
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const [showFilters, setShowFilters] = useState(false);
  const [filterWorkspace, setFilterWorkspace] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: conversationsData, isLoading: loadingConversations } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>(`/api/conversations?isArchived=false`),
    staleTime: 30_000,
  });

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
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

  const isAdmin = user?.role === "org-admin" || user?.role === "admin";

  return (
    <>
      <aside
        className={clsx(
          "flex flex-col h-full bg-surface-secondary border-r border-border transition-all duration-200",
          sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden",
        )}
        aria-hidden={!sidebarOpen}
        {...(!sidebarOpen && { inert: "" as any })}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
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
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="px-2 pt-3 pb-2 space-y-0.5" aria-label={t("nav.main", { defaultValue: "Main navigation" })}>
          <SidebarLink icon={MessageSquare} label={t("nav.conversations", { defaultValue: "Conversations" })} to="/" exact />
          <SidebarLink icon={Microscope} label={t("nav.research", { defaultValue: "Research" })} to="/research" />
          <SidebarLink icon={BookOpen} label={t("nav.knowledge", { defaultValue: "Knowledge" })} to="/knowledge" />
          <SidebarLink icon={Compass} label={t("nav.explore", { defaultValue: "Explore" })} to="/explore" />
          <SidebarLink icon={FolderKanban} label={t("nav.workspaces", { defaultValue: "Workspaces" })} to="/workspaces" />
          <SidebarLink icon={HardDrive} label={t("nav.files", { defaultValue: "Files" })} to="/files" />
        </nav>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

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
              <select
                value={filterWorkspace}
                onChange={(e) => setFilterWorkspace(e.target.value)}
                aria-label={t("search.filter.workspace", { defaultValue: "Filter by workspace" })}
                className="w-full h-7 px-2 text-[11px] bg-surface border border-border rounded-lg text-text"
              >
                <option value="">{t("search.filter.allWorkspaces", { defaultValue: "All workspaces" })}</option>
                {workspaces.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Bulk Actions */}
        {bulkMode && selected.size > 0 && (
          <div className="px-3 pt-2 flex gap-1.5">
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
        <nav aria-label={t("nav.conversations", { defaultValue: "Conversations" })} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {loadingConversations ? (
            <ConversationListSkeleton />
          ) : filteredConversations.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-text-tertiary">{t("conversations.empty")}</p>
              <p className="text-xs text-text-tertiary mt-1">{t("conversations.startPrompt")}</p>
            </div>
          ) : (
            filteredConversations.map((conv: any) => (
              <button
                key={conv.id}
                onClick={() => {
                  if (bulkMode) {
                    toggleSelect(conv.id);
                  } else {
                    navigate({ to: `/conversations/${conv.id}` });
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors group"
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
            ))
          )}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <SidebarLink icon={Settings} label={t("nav.settings")} to="/settings" />
          <SidebarLink icon={HelpCircle} label={t("nav.help")} to="/help" />
          {isAdmin && <SidebarLink icon={ShieldCheck} label={t("nav.admin")} to="/admin" />}
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

function SidebarLink({ icon: Icon, label, to, exact }: { icon: any; label: string; to: string; exact?: boolean }) {
  const matchRoute = useMatchRoute();
  const isActive = exact
    ? matchRoute({ to, fuzzy: false }) || (to === "/" && matchRoute({ to: "/", fuzzy: false }))
    : matchRoute({ to, fuzzy: true });

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
