import { useState, useCallback, useMemo, type DragEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Folder,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Tag,
  MessageSquare,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Archive,
  GripVertical,
  CheckSquare,
  Square,
  Filter,
  X,
  FolderInput,
  Search,
} from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Dropdown, DropdownItem } from "../../components/ui/Dropdown";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/folders")({
  component: FoldersPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface FolderData {
  id: string;
  name: string;
  parentFolderId: string | null;
  sortOrder: number;
  conversationCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ConversationData {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  modelId: string | null;
  workspaceId: string | null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

function FoldersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"folders" | "tags">("folders");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderData | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Bulk selection
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());

  // Conversation filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterWorkspace, setFilterWorkspace] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Move-to-folder dialog
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState("");

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: foldersData } = useQuery({
    queryKey: ["conversation-folders"],
    queryFn: () => api.get<{ data: FolderData[] }>("/api/conversations/folders"),
  });

  const { data: tagsData } = useQuery({
    queryKey: ["conversation-tags"],
    queryFn: () => api.get<any>("/api/conversations/tags"),
  });

  const { data: folderDetail } = useQuery({
    queryKey: ["conversation-folders", "detail", selectedFolder],
    queryFn: () =>
      api.get<FolderData & { conversations: any[] }>(
        `/api/conversations/folders/${selectedFolder}`,
      ),
    enabled: !!selectedFolder,
  });

  const { data: unfolderedData } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>("/api/conversations?isArchived=false"),
    staleTime: 30_000,
  });

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<any>("/api/workspaces"),
    staleTime: 60_000,
  });

  const folders: FolderData[] = (foldersData as any)?.data ?? [];
  const tagList = (tagsData as any)?.data ?? [];
  const workspaces = (workspacesData as any)?.data ?? [];
  const allConversations: ConversationData[] = (unfolderedData as any)?.data ?? [];

  // Build folder tree
  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentFolderId),
    [folders],
  );
  const childFolders = useCallback(
    (parentId: string) => folders.filter((f) => f.parentFolderId === parentId),
    [folders],
  );

  // Conversations for the selected folder (or all if none selected)
  const displayConversations = useMemo(() => {
    let convs: any[] = selectedFolder
      ? (folderDetail as any)?.conversations ?? []
      : allConversations;

    // Apply filters
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      convs = convs.filter(
        (c: any) => (c.title ?? "").toLowerCase().includes(q),
      );
    }
    if (filterModel) {
      convs = convs.filter((c: any) => c.modelId === filterModel);
    }
    if (filterWorkspace) {
      convs = convs.filter((c: any) => c.workspaceId === filterWorkspace);
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      convs = convs.filter((c: any) => new Date(c.createdAt) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      convs = convs.filter((c: any) => new Date(c.createdAt) <= to);
    }

    return convs;
  }, [selectedFolder, folderDetail, allConversations, filterSearch, filterModel, filterWorkspace, filterDateFrom, filterDateTo]);

  const hasActiveFilters = filterDateFrom || filterDateTo || filterModel || filterWorkspace || filterSearch;

  // ─── Mutations ───────────────────────────────────────────────────────────

  const invalidateFolders = () => {
    queryClient.invalidateQueries({ queryKey: ["conversation-folders"] });
    if (selectedFolder) {
      queryClient.invalidateQueries({
        queryKey: ["conversation-folders", "detail", selectedFolder],
      });
    }
  };

  const createFolderMut = useMutation({
    mutationFn: (data: { name: string; parentFolderId?: string }) =>
      editingFolder
        ? api.patch(`/api/conversations/folders/${editingFolder.id}`, data)
        : api.post("/api/conversations/folders", data),
    onSuccess: () => {
      invalidateFolders();
      setShowCreateFolder(false);
      setEditingFolder(null);
      toast(
        editingFolder
          ? t("folders.folderUpdated", "Folder updated")
          : t("folders.folderCreated", "Folder created"),
        "success",
      );
    },
    onError: (err: any) =>
      toast(err.message ?? t("folders.folderSaveFailed", "Failed to save folder"), "error"),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/conversations/folders/${id}`),
    onSuccess: () => {
      invalidateFolders();
      if (selectedFolder) setSelectedFolder(null);
      toast(t("folders.folderDeleted", "Folder deleted"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("folders.folderDeleteFailed", "Failed to delete folder"), "error"),
  });

  const moveToFolderMut = useMutation({
    mutationFn: (data: { conversationIds: string[]; folderId: string }) =>
      api.post("/api/conversations/folders/move", data),
    onSuccess: () => {
      invalidateFolders();
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      setSelectedConversations(new Set());
      setShowMoveDialog(false);
      toast(t("folders.conversationsMoved", "Conversations moved"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("folders.moveFailed", "Failed to move conversations"), "error"),
  });

  const bulkActionMut = useMutation({
    mutationFn: (data: {
      conversationIds: string[];
      action: "archive" | "delete" | "move_to_folder";
      folderId?: string;
    }) => api.post("/api/conversations/bulk", data),
    onSuccess: () => {
      invalidateFolders();
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      setSelectedConversations(new Set());
      setBulkMode(false);
      toast(t("folders.bulkActionComplete", "Action completed"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("folders.bulkActionFailed", "Action failed"), "error"),
  });

  const createTagMut = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      api.post("/api/conversations/tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags"] });
      toast(t("folders.tagCreated", "Tag created"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("folders.tagCreateFailed", "Failed to create tag"), "error"),
  });

  const deleteTagMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/conversations/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags"] });
      toast(t("folders.tagDeleted", "Tag deleted"), "success");
    },
    onError: (err: any) =>
      toast(err.message ?? t("folders.tagDeleteFailed", "Failed to delete tag"), "error"),
  });

  // ─── Drag & Drop ────────────────────────────────────────────────────────

  const handleDragStart = (e: DragEvent, conversationId: string) => {
    e.dataTransfer.setData("text/plain", conversationId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const conversationId = e.dataTransfer.getData("text/plain");
    if (conversationId) {
      moveToFolderMut.mutate({ conversationIds: [conversationId], folderId });
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const toggleExpanded = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const toggleSelectConversation = (id: string) => {
    setSelectedConversations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedConversations.size === displayConversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(displayConversations.map((c: any) => c.id ?? c.conversationId)));
    }
  };

  const COLORS = [
    "#6366f1",
    "#ec4899",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
    "#8b5cf6",
    "#14b8a6",
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-bold text-text">
              {t("folders.title", "Organization")}
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-secondary rounded-lg w-fit mb-6">
          <button
            onClick={() => setTab("folders")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === "folders"
                ? "bg-surface text-text shadow-sm"
                : "text-text-tertiary hover:text-text"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />{" "}
            {t("folders.foldersTab", "Folders")} ({folders.length})
          </button>
          <button
            onClick={() => setTab("tags")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === "tags"
                ? "bg-surface text-text shadow-sm"
                : "text-text-tertiary hover:text-text"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />{" "}
            {t("folders.tagsTab", "Tags")} ({tagList.length})
          </button>
        </div>

        {/* ─── Folders Tab ──────────────────────────────────────────── */}
        {tab === "folders" && (
          <div className="flex gap-6">
            {/* Folder sidebar tree */}
            <div className="w-64 shrink-0 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                  {t("folders.folderTree", "Folders")}
                </span>
                <button
                  onClick={() => {
                    setEditingFolder(null);
                    setShowCreateFolder(true);
                  }}
                  className="p-1 text-text-tertiary hover:text-primary rounded-lg hover:bg-surface-secondary"
                  title={t("folders.newFolder", "New Folder")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* All conversations (unfiled) */}
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                  selectedFolder === null
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-secondary hover:bg-surface-secondary hover:text-text"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {t("folders.allConversations", "All Conversations")}
                <span className="ml-auto text-[10px] text-text-tertiary">
                  {allConversations.length}
                </span>
              </button>

              {/* Folder tree */}
              {rootFolders.length === 0 && (
                <p className="text-xs text-text-tertiary px-3 py-4">
                  {t("folders.noFolders", "No folders yet. Create one to organize conversations.")}
                </p>
              )}
              {rootFolders.map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  isSelected={selectedFolder === folder.id}
                  isExpanded={expandedFolders.has(folder.id)}
                  isDragOver={dragOverFolderId === folder.id}
                  childFolders={childFolders}
                  expandedFolders={expandedFolders}
                  selectedFolder={selectedFolder}
                  dragOverFolderId={dragOverFolderId}
                  onSelect={(id) => {
                    setSelectedFolder(id);
                    setSelectedConversations(new Set());
                    setBulkMode(false);
                  }}
                  onToggleExpand={toggleExpanded}
                  onEdit={(f) => {
                    setEditingFolder(f);
                    setShowCreateFolder(true);
                  }}
                  onDelete={(id) => {
                    const folder = folders.find((f) => f.id === id);
                    if (window.confirm(t("folders.confirmDelete", 'Delete folder "{{name}}"? Conversations inside will be unassigned.', { name: folder?.name ?? "" }))) {
                      deleteFolderMut.mutate(id);
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  t={t}
                />
              ))}
            </div>

            {/* Conversation list */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-medium text-text mr-auto">
                  {selectedFolder
                    ? folders.find((f) => f.id === selectedFolder)?.name ?? "Folder"
                    : t("folders.allConversations", "All Conversations")}
                  <span className="text-text-tertiary ml-2 font-normal">
                    ({displayConversations.length})
                  </span>
                </h2>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showFilters || hasActiveFilters
                      ? "bg-primary/10 text-primary"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title={t("folders.toggleFilters", "Toggle filters")}
                >
                  <Filter className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) setSelectedConversations(new Set());
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    bulkMode
                      ? "bg-primary/10 text-primary"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title={t("folders.bulkSelect", "Bulk select")}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Filters */}
              {showFilters && (
                <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">
                      {t("folders.filter.search", "Search")}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary" />
                      <input
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder={t("folders.filter.searchPlaceholder", "Filter by title...")}
                        className="h-8 pl-7 pr-2 w-40 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">
                      {t("folders.filter.from", "From")}
                    </label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">
                      {t("folders.filter.to", "To")}
                    </label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">
                      {t("folders.filter.model", "Model")}
                    </label>
                    <input
                      type="text"
                      value={filterModel}
                      onChange={(e) => setFilterModel(e.target.value)}
                      placeholder="e.g. gpt-4"
                      className="h-8 w-28 px-2 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-tertiary mb-1">
                      {t("folders.filter.workspace", "Workspace")}
                    </label>
                    <select
                      value={filterWorkspace}
                      onChange={(e) => setFilterWorkspace(e.target.value)}
                      className="h-8 px-2 text-xs bg-surface border border-border rounded-lg text-text"
                    >
                      <option value="">{t("folders.filter.all", "All")}</option>
                      {workspaces.map((ws: any) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setFilterDateFrom("");
                        setFilterDateTo("");
                        setFilterModel("");
                        setFilterWorkspace("");
                        setFilterSearch("");
                      }}
                      className="h-8 px-2 text-xs text-text-tertiary hover:text-text-secondary flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> {t("folders.filter.clear", "Clear")}
                    </button>
                  )}
                </div>
              )}

              {/* Bulk action bar */}
              {bulkMode && selectedConversations.size > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <button
                    onClick={selectAll}
                    className="text-xs text-primary hover:text-primary/80"
                  >
                    {selectedConversations.size === displayConversations.length
                      ? t("folders.bulk.deselectAll", "Deselect all")
                      : t("folders.bulk.selectAll", "Select all")}
                  </button>
                  <span className="text-xs text-text-tertiary">
                    {selectedConversations.size} {t("folders.bulk.selected", "selected")}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMoveDialog(true)}
                    >
                      <FolderInput className="h-3 w-3" />{" "}
                      {t("folders.bulk.move", "Move")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        bulkActionMut.mutate({
                          conversationIds: Array.from(selectedConversations),
                          action: "archive",
                        })
                      }
                    >
                      <Archive className="h-3 w-3" />{" "}
                      {t("folders.bulk.archive", "Archive")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("folders.bulk.deleteConfirm", "Delete selected conversations?"))) {
                          bulkActionMut.mutate({
                            conversationIds: Array.from(selectedConversations),
                            action: "delete",
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-danger" />{" "}
                      <span className="text-danger">{t("folders.bulk.delete", "Delete")}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Conversation list */}
              {displayConversations.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">
                    {selectedFolder
                      ? t("folders.emptyFolder", "No conversations in this folder")
                      : t("folders.noConversations", "No conversations yet")}
                  </p>
                  {selectedFolder && (
                    <p className="text-xs text-text-tertiary mt-1">
                      {t(
                        "folders.emptyFolderHint",
                        "Drag conversations here or use bulk move",
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {displayConversations.map((conv: any) => {
                    const convId = conv.id ?? conv.conversationId;
                    const isSelected = selectedConversations.has(convId);
                    return (
                      <div
                        key={convId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, convId)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing group ${
                          isSelected
                            ? "bg-primary/5 border-primary/20"
                            : "bg-surface-secondary border-border hover:border-border-strong"
                        }`}
                      >
                        {/* Bulk checkbox */}
                        {bulkMode && (
                          <button
                            onClick={() => toggleSelectConversation(convId)}
                            className="text-text-tertiary hover:text-primary"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        {/* Drag handle */}
                        <GripVertical className="h-3.5 w-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />

                        {/* Content */}
                        <button
                          onClick={() =>
                            navigate({ to: `/conversations/${convId}` })
                          }
                          className="flex-1 min-w-0 text-left"
                        >
                          <p className="text-sm font-medium text-text truncate group-hover:text-primary transition-colors">
                            {conv.title ?? "Untitled"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {conv.isArchived && (
                              <Badge variant="default">
                                {t("folders.archived", "archived")}
                              </Badge>
                            )}
                            <span className="text-[10px] text-text-tertiary">
                              {conv.updatedAt &&
                                formatDistanceToNow(new Date(conv.updatedAt), {
                                  addSuffix: true,
                                })}
                            </span>
                          </div>
                        </button>

                        {/* Actions */}
                        <Dropdown
                          trigger={
                            <button className="p-1 text-text-tertiary hover:text-text rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" aria-label={t("folders.moreActions", "More actions")}>
                              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          }
                        >
                          <DropdownItem
                            onClick={() => {
                              setSelectedConversations(new Set([convId]));
                              setShowMoveDialog(true);
                            }}
                          >
                            <FolderInput className="h-3.5 w-3.5" />{" "}
                            {t("folders.moveToFolder", "Move to folder")}
                          </DropdownItem>
                          <DropdownItem
                            onClick={() =>
                              bulkActionMut.mutate({
                                conversationIds: [convId],
                                action: "archive",
                              })
                            }
                          >
                            <Archive className="h-3.5 w-3.5" />{" "}
                            {t("folders.archive", "Archive")}
                          </DropdownItem>
                          <DropdownItem
                            danger
                            onClick={() =>
                              bulkActionMut.mutate({
                                conversationIds: [convId],
                                action: "delete",
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />{" "}
                            {t("folders.delete", "Delete")}
                          </DropdownItem>
                        </Dropdown>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Tags Tab ─────────────────────────────────────────────── */}
        {tab === "tags" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <TagCreateForm
                onSubmit={(data) => createTagMut.mutate(data)}
                isPending={createTagMut.isPending}
                t={t}
              />
            </div>

            {tagList.length === 0 ? (
              <div className="text-center py-16">
                <Tag className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-secondary">
                  {t("folders.noTags", "No tags yet")}
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {t("folders.noTagsHint", "Create tags to label your conversations")}
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tagList.map((tag: any) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-secondary border border-border"
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color ?? "#6366f1" }}
                    />
                    <span className="text-xs font-medium text-text">{tag.name}</span>
                    <button
                      onClick={() => {
                        if (window.confirm(t("folders.confirmDeleteTag", 'Delete tag "{{name}}"?', { name: tag.name }))) {
                          deleteTagMut.mutate(tag.id);
                        }
                      }}
                      className="text-text-tertiary hover:text-danger"
                      aria-label={t("folders.deleteTag", "Delete tag")}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Create/Edit Folder Dialog ────────────────────────────── */}
        <Dialog
          open={showCreateFolder}
          onClose={() => {
            setShowCreateFolder(false);
            setEditingFolder(null);
          }}
          title={
            editingFolder
              ? t("folders.editFolder", "Edit Folder")
              : t("folders.newFolder", "New Folder")
          }
        >
          <FolderForm
            initial={editingFolder}
            folders={folders}
            onSubmit={(data) => createFolderMut.mutate(data)}
            isPending={createFolderMut.isPending}
            onCancel={() => {
              setShowCreateFolder(false);
              setEditingFolder(null);
            }}
            t={t}
          />
        </Dialog>

        {/* ─── Move-to-Folder Dialog ────────────────────────────────── */}
        <Dialog
          open={showMoveDialog}
          onClose={() => {
            setShowMoveDialog(false);
            setMoveTargetFolderId("");
          }}
          title={t("folders.moveToFolder", "Move to folder")}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {t("folders.moveDescription", "Select a folder to move {{count}} conversation(s) into.", {
                count: selectedConversations.size,
              })}
            </p>
            <select
              value={moveTargetFolderId}
              onChange={(e) => setMoveTargetFolderId(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            >
              <option value="">
                {t("folders.selectFolder", "Select a folder...")}
              </option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMoveDialog(false);
                  setMoveTargetFolderId("");
                }}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                variant="primary"
                disabled={!moveTargetFolderId}
                loading={moveToFolderMut.isPending}
                onClick={() => {
                  if (moveTargetFolderId) {
                    moveToFolderMut.mutate({
                      conversationIds: Array.from(selectedConversations),
                      folderId: moveTargetFolderId,
                    });
                  }
                }}
              >
                {t("folders.move", "Move")}
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Folder Tree Item ────────────────────────────────────────────────────────

function FolderTreeItem({
  folder,
  depth,
  isSelected,
  isExpanded,
  isDragOver,
  childFolders,
  expandedFolders,
  selectedFolder,
  dragOverFolderId,
  onSelect,
  onToggleExpand,
  onEdit,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
  t,
}: {
  folder: FolderData;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  isDragOver: boolean;
  childFolders: (parentId: string) => FolderData[];
  expandedFolders: Set<string>;
  selectedFolder: string | null;
  dragOverFolderId: string | null;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onEdit: (folder: FolderData) => void;
  onDelete: (id: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, folderId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>, folderId: string) => void;
  t: any;
}) {
  const children = childFolders(folder.id);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        onDragOver={(e) => onDragOver(e as any, folder.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e as any, folder.id)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors group ${
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : isDragOver
              ? "bg-primary/5 border border-primary/30 border-dashed"
              : "text-text-secondary hover:bg-surface-secondary hover:text-text"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => onToggleExpand(folder.id)}
          className={`p-0.5 rounded transition-colors ${
            hasChildren
              ? "text-text-tertiary hover:text-text"
              : "text-transparent pointer-events-none"
          }`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {/* Folder icon + name */}
        <button
          onClick={() => onSelect(folder.id)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
          <span className="text-[10px] text-text-tertiary ml-auto shrink-0">
            {folder.conversationCount}
          </span>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(folder)}
            className="p-0.5 text-text-tertiary hover:text-text rounded"
            title={t("folders.edit", "Edit")}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(folder.id)}
            className="p-0.5 text-text-tertiary hover:text-danger rounded"
            title={t("folders.delete", "Delete")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        hasChildren &&
        children.map((child) => (
          <FolderTreeItem
            key={child.id}
            folder={child}
            depth={depth + 1}
            isSelected={selectedFolder === child.id}
            isExpanded={expandedFolders.has(child.id)}
            isDragOver={dragOverFolderId === child.id}
            childFolders={childFolders}
            expandedFolders={expandedFolders}
            selectedFolder={selectedFolder}
            dragOverFolderId={dragOverFolderId}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            t={t}
          />
        ))}
    </div>
  );
}

// ─── Folder Form ─────────────────────────────────────────────────────────────

function FolderForm({
  initial,
  folders,
  onSubmit,
  isPending,
  onCancel,
  t,
}: {
  initial: FolderData | null;
  folders: FolderData[];
  onSubmit: (data: { name: string; parentFolderId?: string }) => void;
  isPending: boolean;
  onCancel: () => void;
  t: any;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [parentId, setParentId] = useState(initial?.parentFolderId ?? "");

  // Exclude self and children from parent options
  const parentOptions = folders.filter((f) => f.id !== initial?.id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, ...(parentId ? { parentFolderId: parentId } : {}) });
      }}
      className="space-y-4"
    >
      <Input
        label={t("folders.form.name", "Name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          {t("folders.form.parent", "Parent Folder")}
        </label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
        >
          <option value="">{t("folders.form.noParent", "None (root level)")}</option>
          {parentOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button type="submit" variant="primary" loading={isPending}>
          {t("common.save", "Save")}
        </Button>
      </div>
    </form>
  );
}

// ─── Tag Create Form ─────────────────────────────────────────────────────────

function TagCreateForm({
  onSubmit,
  isPending,
  t,
}: {
  onSubmit: (data: { name: string; color?: string }) => void;
  isPending: boolean;
  t: any;
}) {
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          onSubmit({ name: name.trim() });
          setName("");
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("folders.tags.placeholder", "New tag name...")}
        className="h-8 px-3 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
      />
      <Button
        type="submit"
        variant="primary"
        size="sm"
        loading={isPending}
        disabled={!name.trim()}
      >
        <Plus className="h-3 w-3" /> {t("folders.tags.add", "Add")}
      </Button>
    </form>
  );
}
