import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Share, GitBranch, Archive, Download, Trash2, MoreHorizontal, Pencil, Pin, PinOff, FileJson, FileText, FileSpreadsheet, Globe, Star } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Dropdown, DropdownItem } from "../ui/Dropdown";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { toast } from "../ui/Toast";
import { ConversationSettings } from "./ConversationSettings";

interface ConversationHeaderProps {
  conversation: any;
}

export function ConversationHeader({ conversation }: ConversationHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(conversation?.title ?? "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateConv = useMutation({
    mutationFn: (data: any) => api.patch(`/api/conversations/${conversation.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversation.id) });
    },
    onError: () => {
      toast(t("errors.updateFailed", { defaultValue: "Failed to update conversation" }), "error");
    },
  });

  const forkConv = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/api/conversations/${conversation.id}/fork`, {}),
    onSuccess: (data) => {
      toast(t("conversation.forked", { defaultValue: "Conversation forked" }), "success");
      navigate({ to: `/conversations/${data.id}` });
    },
    onError: () => {
      toast(t("errors.forkFailed", { defaultValue: "Failed to fork conversation" }), "error");
    },
  });

  const archiveConv = useMutation({
    mutationFn: () => api.post(`/api/conversations/${conversation.id}/archive`),
    onSuccess: () => {
      toast(t("conversation.archived", { defaultValue: "Conversation archived" }), "success");
      navigate({ to: "/" });
    },
    onError: () => {
      toast(t("errors.archiveFailed", { defaultValue: "Failed to archive conversation" }), "error");
    },
  });

  const deleteConv = useMutation({
    mutationFn: () => api.delete(`/api/conversations/${conversation.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      toast(t("conversation.deleted", { defaultValue: "Conversation deleted" }), "success");
      navigate({ to: "/" });
    },
    onError: () => {
      toast(t("errors.deleteFailed", { defaultValue: "Failed to delete conversation" }), "error");
    },
  });

  const handleShare = async () => {
    try {
      const result = await api.post<{ shareToken: string }>(`/api/conversations/${conversation.id}/share`);
      const url = `${window.location.origin}/shared/${result.shareToken}`;
      navigator.clipboard.writeText(url);
      toast(t("conversation.shareCopied", { defaultValue: "Share link copied to clipboard" }), "success");
    } catch {
      toast(t("errors.shareFailed", { defaultValue: "Failed to create share link" }), "error");
    }
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

  const handleDeleteConfirm = () => {
    deleteConv.mutate();
    setShowDeleteConfirm(false);
  };

  const apiBase = import.meta.env.VITE_API_URL ?? "";

  const handleExportJson = () => {
    window.open(`${apiBase}/api/export/conversations/${conversation.id}/json`, "_blank");
  };

  const handleExportMd = () => {
    window.open(`${apiBase}/api/export/conversations/${conversation.id}/markdown`, "_blank");
  };

  const handleExportCsv = () => {
    window.open(`${apiBase}/api/export/conversations/${conversation.id}/csv`, "_blank");
  };

  const handleExportHtml = () => {
    window.open(`${apiBase}/api/export/conversations/${conversation.id}/html`, "_blank");
  };

  if (!conversation) return null;

  return (
    <>
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          {conversation.isPinned && (
            <Star className="h-4 w-4 text-primary shrink-0 fill-primary/20" aria-hidden="true" />
          )}
          {isEditing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="text-sm font-medium text-text bg-surface-secondary border border-border rounded-lg px-2.5 py-1"
              aria-label={t("conversation.renameInput", { defaultValue: "Conversation title" })}
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-text truncate hover:text-primary transition-colors"
            >
              {conversation.title ?? t("conversation.untitled", { defaultValue: "Untitled" })}
            </button>
          )}

          {conversation.model && (
            <Badge variant="primary">{conversation.model}</Badge>
          )}

          {(conversation.totalTokens ?? 0) > 0 && (
            <span className="text-[10px] text-text-tertiary shrink-0" title={`Estimated cost: $${((conversation.estimatedCostCents ?? 0) / 100).toFixed(4)}`}>
              {(conversation.totalTokens ?? 0).toLocaleString()} tokens
              {conversation.estimatedCostCents > 0 && ` ($${(conversation.estimatedCostCents / 100).toFixed(4)})`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors"
            aria-label={t("conversation.settings", { defaultValue: "Conversation settings" })}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>

          <Dropdown
            trigger={
              <button
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors"
                aria-label={t("conversation.moreActions", { defaultValue: "More actions" })}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          >
            <DropdownItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.rename", { defaultValue: "Rename" })}
            </DropdownItem>
            <DropdownItem onClick={handlePin}>
              {conversation.isPinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
              {conversation.isPinned ? t("conversation.unpin", { defaultValue: "Unpin" }) : t("conversation.pin", { defaultValue: "Pin" })}
            </DropdownItem>
            <DropdownItem onClick={handleShare}>
              <Share className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.share", { defaultValue: "Share" })}
            </DropdownItem>
            <DropdownItem onClick={() => forkConv.mutate()} disabled={forkConv.isPending}>
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.fork", { defaultValue: "Fork" })}
            </DropdownItem>
            <DropdownItem onClick={handleExportJson}>
              <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.exportJson", { defaultValue: "Export JSON" })}
            </DropdownItem>
            <DropdownItem onClick={handleExportMd}>
              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.exportMarkdown", { defaultValue: "Export Markdown" })}
            </DropdownItem>
            <DropdownItem onClick={handleExportCsv}>
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.exportCsv", { defaultValue: "Export CSV" })}
            </DropdownItem>
            <DropdownItem onClick={handleExportHtml}>
              <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.exportHtml", { defaultValue: "Export HTML" })}
            </DropdownItem>
            <DropdownItem onClick={() => archiveConv.mutate()} disabled={archiveConv.isPending}>
              <Archive className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.archive", { defaultValue: "Archive" })}
            </DropdownItem>
            <DropdownItem onClick={() => setShowDeleteConfirm(true)} danger disabled={deleteConv.isPending}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("conversation.delete", { defaultValue: "Delete" })}
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t("conversation.deleteConfirmTitle", { defaultValue: "Delete conversation" })}
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("conversation.deleteConfirmMessage", { defaultValue: "Are you sure you want to delete this conversation? This action cannot be undone." })}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            {t("actions.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteConfirm}
            loading={deleteConv.isPending}
          >
            {t("actions.delete", { defaultValue: "Delete" })}
          </Button>
        </div>
      </Dialog>

      <ConversationSettings
        conversationId={conversation.id}
        conversation={conversation}
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
