import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, Plus, Pencil, Trash2, Tag, MoreHorizontal, MessageSquare, FolderOpen } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/folders")({
  component: FoldersPage,
});

function FoldersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [tab, setTab] = useState<"folders" | "tags">("folders");

  const { data: folders } = useQuery({
    queryKey: ["conversation-folders"],
    queryFn: () => api.get<any>("/api/conversations/folders"),
  });

  const { data: tags } = useQuery({
    queryKey: ["conversation-tags"],
    queryFn: () => api.get<any>("/api/conversations/tags"),
  });

  const createFolder = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      editingFolder
        ? api.patch(`/api/conversations/folders/${editingFolder.id}`, data)
        : api.post("/api/conversations/folders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-folders"] });
      setShowCreate(false);
      setEditingFolder(null);
      toast("Folder saved", "success");
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => api.delete(`/api/conversations/folders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-folders"] });
      toast("Folder deleted", "success");
    },
  });

  const createTag = useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.post("/api/conversations/tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags"] });
      toast("Tag created", "success");
    },
  });

  const deleteTag = useMutation({
    mutationFn: (id: string) => api.delete(`/api/conversations/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-tags"] });
      toast("Tag deleted", "success");
    },
  });

  const folderList = (folders as any)?.data ?? [];
  const tagList = (tags as any)?.data ?? [];

  const COLORS = ["#6366f1", "#ec4899", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#14b8a6"];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-text">Organization</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-secondary rounded-lg w-fit mb-6">
          <button
            onClick={() => setTab("folders")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === "folders" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" /> Folders ({folderList.length})
          </button>
          <button
            onClick={() => setTab("tags")}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === "tags" ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text"
            }`}
          >
            <Tag className="h-3.5 w-3.5" /> Tags ({tagList.length})
          </button>
        </div>

        {/* Folders Tab */}
        {tab === "folders" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => { setEditingFolder(null); setShowCreate(true); }}>
                <Plus className="h-3.5 w-3.5" /> New Folder
              </Button>
            </div>

            {folderList.length === 0 ? (
              <div className="text-center py-16">
                <Folder className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No folders yet</p>
                <p className="text-xs text-text-tertiary mt-1">Create folders to organize your conversations</p>
              </div>
            ) : (
              folderList.map((folder: any) => (
                <div key={folder.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${folder.color ?? "#6366f1"}20` }}>
                      <Folder className="h-4 w-4" style={{ color: folder.color ?? "#6366f1" }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">{folder.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {folder.conversationCount ?? 0} conversations
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingFolder(folder); setShowCreate(true); }} className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-surface">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteFolder.mutate(folder.id)} className="p-1.5 text-text-tertiary hover:text-danger rounded-lg hover:bg-surface">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tags Tab */}
        {tab === "tags" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <TagCreateForm onSubmit={(data) => createTag.mutate(data)} isPending={createTag.isPending} />
            </div>

            {tagList.length === 0 ? (
              <div className="text-center py-16">
                <Tag className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
                <p className="text-sm text-text-secondary">No tags yet</p>
                <p className="text-xs text-text-tertiary mt-1">Create tags to label your conversations</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tagList.map((tag: any) => (
                  <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-secondary border border-border">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color ?? "#6366f1" }} />
                    <span className="text-xs font-medium text-text">{tag.name}</span>
                    <button onClick={() => deleteTag.mutate(tag.id)} className="text-text-tertiary hover:text-danger">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Folder Dialog */}
        <Dialog open={showCreate} onClose={() => { setShowCreate(false); setEditingFolder(null); }} title={editingFolder ? "Edit Folder" : "New Folder"}>
          <FolderForm
            initial={editingFolder}
            onSubmit={(data) => createFolder.mutate(data)}
            isPending={createFolder.isPending}
            onCancel={() => { setShowCreate(false); setEditingFolder(null); }}
            colors={COLORS}
          />
        </Dialog>
      </div>
    </div>
  );
}

function FolderForm({ initial, onSubmit, isPending, onCancel, colors }: {
  initial: any; onSubmit: (data: any) => void; isPending: boolean; onCancel: () => void; colors: string[];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? colors[0]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, color }); }} className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <div>
        <label className="block text-sm font-medium text-text mb-2">Color</label>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 transition-colors ${
                color === c ? "border-text scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={isPending}>Save</Button>
      </div>
    </form>
  );
}

function TagCreateForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const [name, setName] = useState("");

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSubmit({ name: name.trim() }); setName(""); } }} className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New tag name..."
        className="h-8 px-3 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
      />
      <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={!name.trim()}>
        <Plus className="h-3 w-3" /> Add
      </Button>
    </form>
  );
}
