import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { MessageSquarePlus, Search, Archive, Pin, Trash2, MoreHorizontal, ChevronLeft, Bot, BookOpen, FolderKanban, Settings, Sparkles, FileText, ShieldCheck, BarChart3, Code2, Microscope, Wrench, Compass, HelpCircle, GitCompare, Puzzle, Filter, CheckSquare, Square, FolderOpen } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { useUIStore } from "../../stores/ui.store";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterWorkspace, setFilterWorkspace] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: conversationsData } = useQuery({
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
      toast("Conversations archived", "success");
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => api.delete(`/api/conversations/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      setSelected(new Set());
      setBulkMode(false);
      toast("Conversations deleted", "success");
    },
  });

  const conversations = conversationsData?.data ?? [];
  const workspaces = (workspacesData as any)?.data ?? [];

  const filteredConversations = conversations.filter((c: any) => {
    if (searchQuery && !c.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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

  return (
    <aside
      className={clsx(
        "flex flex-col h-full bg-surface-secondary border-r border-border transition-all duration-200",
        sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm tracking-tight">NOVA</span>
        </div>
        <button onClick={toggleSidebar} className="text-text-tertiary hover:text-text p-1 rounded-lg hover:bg-surface-tertiary">
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* New Conversation */}
      <div className="px-3 pt-3 flex gap-1.5">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          onClick={() => navigate({ to: "/conversations/new" })}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {t("conversations.new")}
        </Button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            "p-1.5 rounded-lg transition-colors",
            showFilters ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
          )}
          title="Filter conversations"
        >
          <Filter className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
          className={clsx(
            "p-1.5 rounded-lg transition-colors",
            bulkMode ? "bg-primary/10 text-primary" : "text-text-tertiary hover:text-text hover:bg-surface-tertiary",
          )}
          title="Bulk select"
        >
          <CheckSquare className="h-4 w-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-3 pt-2 space-y-1.5">
          {workspaces.length > 0 && (
            <select
              value={filterWorkspace}
              onChange={(e) => setFilterWorkspace(e.target.value)}
              className="w-full h-7 px-2 text-[11px] bg-surface border border-border rounded text-text"
            >
              <option value="">All workspaces</option>
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
            className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-border rounded text-text-secondary hover:text-text"
          >
            <Archive className="h-3 w-3" /> Archive ({selected.size})
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} conversations?`))
                bulkDelete.mutate(Array.from(selected));
            }}
            className="flex-1 flex items-center justify-center gap-1 h-7 text-[11px] bg-surface border border-danger/30 rounded text-danger hover:bg-danger/5"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder={t("conversations.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-surface border border-border text-text placeholder:text-text-tertiary focus:outline-primary"
          />
        </div>
      </div>

      {/* Conversation List */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filteredConversations.length === 0 ? (
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
                  ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                  : <Square className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
              )}
              {!bulkMode && conv.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
              <span className="truncate flex-1">{conv.title ?? "Untitled"}</span>
              {conv.workspaceId && <FolderOpen className="h-3 w-3 text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100" />}
            </button>
          ))
        )}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border px-2 py-2 space-y-0.5">
        <SidebarLink icon={Bot} label="Agents" to="/agents" />
        <SidebarLink icon={BookOpen} label="Knowledge" to="/knowledge" />
        <SidebarLink icon={Wrench} label="Tools" to="/tools" />
        <SidebarLink icon={Puzzle} label="MCP" to="/mcp" />
        <SidebarLink icon={FolderKanban} label="Workspaces" to="/workspaces" />
        <SidebarLink icon={FileText} label="Prompts" to="/prompts" />
        <SidebarLink icon={Microscope} label="Research" to="/research" />
        <SidebarLink icon={Code2} label="Playground" to="/playground" />
        <SidebarLink icon={GitCompare} label="Compare" to="/model-compare" />
        <SidebarLink icon={Compass} label="Explore" to="/explore" />
        <SidebarLink icon={BarChart3} label="Usage" to="/usage" />
        <SidebarLink icon={ShieldCheck} label="Admin" to="/admin" />
        <SidebarLink icon={Settings} label="Settings" to="/settings" />
        <SidebarLink icon={HelpCircle} label="Help" to="/help" />
      </div>
    </aside>
  );
}

function SidebarLink({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to })}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
