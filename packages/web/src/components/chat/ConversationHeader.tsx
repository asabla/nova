import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Share, GitBranch, Archive, Download, Trash2, MoreHorizontal, Pencil, Pin, PinOff } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Dropdown, DropdownItem } from "../ui/Dropdown";
import { toast } from "../ui/Toast";
import { ConversationSettings } from "./ConversationSettings";

interface ConversationHeaderProps {
  conversation: any;
}

export function ConversationHeader({ conversation }: ConversationHeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(conversation?.title ?? "");

  const updateConv = useMutation({
    mutationFn: (data: any) => api.patch(`/api/conversations/${conversation.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversation.id) });
    },
  });

  const forkConv = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/api/conversations/${conversation.id}/fork`),
    onSuccess: (data) => {
      toast("Conversation forked", "success");
      navigate({ to: `/conversations/${data.id}` });
    },
  });

  const archiveConv = useMutation({
    mutationFn: () => api.post(`/api/conversations/${conversation.id}/archive`),
    onSuccess: () => {
      toast("Conversation archived", "success");
      navigate({ to: "/" });
    },
  });

  const deleteConv = useMutation({
    mutationFn: () => api.delete(`/api/conversations/${conversation.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      toast("Conversation deleted", "success");
      navigate({ to: "/" });
    },
  });

  const handleShare = async () => {
    const result = await api.post<{ shareToken: string }>(`/api/conversations/${conversation.id}/share`);
    const url = `${window.location.origin}/shared/${result.shareToken}`;
    navigator.clipboard.writeText(url);
    toast("Share link copied to clipboard", "success");
  };

  const handleRename = () => {
    if (title.trim() && title !== conversation?.title) {
      updateConv.mutate({ title: title.trim() });
    }
    setIsEditing(false);
  };

  const handlePin = () => {
    updateConv.mutate({ isPinned: !conversation?.isPinned });
  };

  const handleExportJson = () => {
    window.open(`/api/export/conversations/${conversation.id}/json`, "_blank");
  };

  const handleExportMd = () => {
    window.open(`/api/export/conversations/${conversation.id}/markdown`, "_blank");
  };

  if (!conversation) return null;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          {conversation.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
          {isEditing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="text-sm font-medium text-text bg-surface-secondary border border-border rounded px-2 py-0.5"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-text truncate hover:text-primary transition-colors"
            >
              {conversation.title ?? "Untitled"}
            </button>
          )}

          {conversation.model && (
            <span className="text-[10px] text-text-tertiary bg-surface-secondary px-1.5 py-0.5 rounded border border-border shrink-0">
              {conversation.model}
            </span>
          )}

          {(conversation.totalTokens ?? 0) > 0 && (
            <span className="text-[10px] text-text-tertiary shrink-0" title={`Estimated cost: $${((conversation.estimatedCostCents ?? 0) / 100).toFixed(4)}`}>
              {(conversation.totalTokens ?? 0).toLocaleString()} tokens
              {conversation.estimatedCostCents > 0 && ` ($${(conversation.estimatedCostCents / 100).toFixed(4)})`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="text-text-tertiary hover:text-text-secondary p-1.5 rounded-lg hover:bg-surface-secondary"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          <Dropdown
            trigger={
              <button className="text-text-tertiary hover:text-text-secondary p-1.5 rounded-lg hover:bg-surface-secondary">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <DropdownItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Rename
            </DropdownItem>
            <DropdownItem onClick={handlePin}>
              {conversation.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {conversation.isPinned ? "Unpin" : "Pin"}
            </DropdownItem>
            <DropdownItem onClick={handleShare}>
              <Share className="h-3.5 w-3.5" /> Share
            </DropdownItem>
            <DropdownItem onClick={() => forkConv.mutate()}>
              <GitBranch className="h-3.5 w-3.5" /> Fork
            </DropdownItem>
            <DropdownItem onClick={handleExportJson}>
              <Download className="h-3.5 w-3.5" /> Export JSON
            </DropdownItem>
            <DropdownItem onClick={handleExportMd}>
              <Download className="h-3.5 w-3.5" /> Export Markdown
            </DropdownItem>
            <DropdownItem onClick={() => archiveConv.mutate()}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </DropdownItem>
            <DropdownItem onClick={() => deleteConv.mutate()} danger>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <ConversationSettings
        conversationId={conversation.id}
        conversation={conversation}
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
