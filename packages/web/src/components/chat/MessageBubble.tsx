import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Copy, Check, ThumbsUp, ThumbsDown, Pencil, RotateCcw, History, X, Send, StickyNote, ChevronDown, GitBranch, Volume2, VolumeX, Paperclip, FileText, Download } from "lucide-react";
import { clsx } from "clsx";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { ArtifactRenderer } from "./ArtifactRenderer";
import { DynamicWidget } from "./DynamicWidget";
import { Avatar } from "../ui/Avatar";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { formatDistanceToNow } from "date-fns";

interface EditHistoryEntry {
  content: string;
  editedAt: string;
}

interface MessageBubbleProps {
  message: {
    id: string;
    conversationId: string;
    senderType: string;
    senderUserId?: string | null;
    content?: string | null;
    isEdited?: boolean;
    editHistory?: EditHistoryEntry[] | null;
    createdAt: string;
    status?: string;
    tokenCountPrompt?: number | null;
    tokenCountCompletion?: number | null;
    costCents?: number | null;
    modelId?: string | null;
    rating?: "up" | "down" | null;
    attachments?: {
      id: string;
      fileId?: string | null;
      filename?: string | null;
      contentType?: string | null;
      sizeBytes?: number | null;
      attachmentType: string;
    }[];
  };
  artifacts?: any[];
  userName?: string;
  onRate?: (messageId: string, rating: 1 | -1) => void;
  onEdit?: (messageId: string, content: string) => void;
  onEditAndRerun?: (messageId: string, content: string) => void;
  onRerun?: (messageId: string, modelId?: string) => void;
  onNote?: (messageId: string, content: string) => void;
  onFork?: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, artifacts, userName, onRate, onEdit, onEditAndRerun, onRerun, onNote, onFork }: MessageBubbleProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [showModelSelector, setShowModelSelector] = useState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const isUser = message.senderType === "user";
  const isAssistant = message.senderType === "assistant";

  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    enabled: showModelSelector,
  });
  const availableModels: any[] = (modelsData as any)?.data ?? [];

  // Close model selector on outside click
  useEffect(() => {
    if (!showModelSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModelSelector]);

  // ---- Text-to-speech ----
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const handleSpeak = useCallback(() => {
    if (!ttsSupported || !message.content) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Strip markdown syntax for cleaner TTS output
    const plainText = message.content
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~>|-]/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = navigator.language || "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [ttsSupported, message.content, isSpeaking]);

  // Cancel TTS on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeaking]);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [fetchedHistory, setFetchedHistory] = useState<EditHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditAndRerunSubmit = () => {
    if (editContent.trim() && onEditAndRerun) {
      onEditAndRerun(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditContent(message.content ?? "");
    setIsEditing(false);
  };

  // Fetch full history from API when panel is opened
  const handleToggleHistory = async () => {
    const nextShow = !showHistory;
    setShowHistory(nextShow);
    if (nextShow && !fetchedHistory) {
      setHistoryLoading(true);
      try {
        const data = await api.get<{ history: EditHistoryEntry[] }>(
          `/api/conversations/${message.conversationId}/messages/${message.id}/history`,
        );
        setFetchedHistory((data as any).history ?? []);
      } catch {
        // Fall back to local edit history if API call fails
        setFetchedHistory((message.editHistory as EditHistoryEntry[]) ?? []);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const editHistory = fetchedHistory ?? (message.editHistory as EditHistoryEntry[]) ?? [];
  const totalTokens = (message.tokenCountPrompt ?? 0) + (message.tokenCountCompletion ?? 0);

  return (
    <div className={clsx("group flex gap-3 px-4 py-4", isUser ? "flex-row-reverse" : "")}>
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <Avatar name={userName} size="sm" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>

      <div className={clsx("flex flex-col", isUser ? "max-w-[80%] items-end" : "flex-1 min-w-0")}>
        {isEditing ? (
          <div className="w-full min-w-[300px]">
            <textarea
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit();
                }
                if (e.key === "Escape") handleEditCancel();
              }}
              className="w-full min-h-[80px] p-3 rounded-xl bg-surface border border-border text-sm text-text resize-y focus:outline-primary"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleEditSubmit}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90"
              >
                <Send className="h-3 w-3" aria-hidden="true" /> {t("common.save")}
              </button>
              {onEditAndRerun && (
                <button
                  onClick={handleEditAndRerunSubmit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary/80 text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" /> {t("messages.saveAndRerun", { defaultValue: "Save & Re-run" })}
                </button>
              )}
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text"
              >
                <X className="h-3 w-3" aria-hidden="true" /> {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              "rounded-2xl px-4 py-2.5",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-surface-secondary border border-border rounded-tl-sm w-full",
              message.status === "failed" && "border-danger/50",
            )}
          >
            {message.content ? (
              isAssistant ? (
                <MarkdownRenderer content={message.content} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              )
            ) : message.status === "streaming" ? (
              <div className="flex gap-1 py-1">
                <span className="h-2 w-2 bg-text-tertiary rounded-full animate-bounce" />
                <span className="h-2 w-2 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="h-2 w-2 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            ) : message.status === "failed" ? (
              <p className="text-sm text-danger" role="alert">{message.content ?? t("errors.messageFailed", { defaultValue: "Message failed to send." })}</p>
            ) : null}
          </div>
        )}

        {/* Artifacts (including dynamic widgets) */}
        {artifacts && artifacts.length > 0 && (
          <div className={clsx("w-full mt-1.5", isUser ? "max-w-[80%] ml-auto" : "")}>
            {artifacts.map((a: any) =>
              a.type === "widget" && a.metadata ? (
                <DynamicWidget key={a.id} config={a.metadata} />
              ) : (
                <ArtifactRenderer
                  key={a.id}
                  artifact={{
                    id: a.id,
                    type: a.type,
                    title: a.title ?? a.type,
                    content: a.content ?? "",
                    language: a.language,
                    metadata: a.metadata,
                  }}
                />
              ),
            )}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={clsx("flex flex-wrap gap-2 mt-1.5", isUser ? "justify-end" : "justify-start")}>
            {message.attachments.map((att) => {
              const isImage = att.contentType?.startsWith("image/");
              const sizeLabel = att.sizeBytes
                ? att.sizeBytes < 1024
                  ? `${att.sizeBytes} B`
                  : att.sizeBytes < 1024 * 1024
                    ? `${(att.sizeBytes / 1024).toFixed(1)} KB`
                    : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                : null;

              return (
                <button
                  key={att.id}
                  onClick={async () => {
                    if (!att.fileId) return;
                    try {
                      const res = await api.get<{ url: string }>(`/api/files/${att.fileId}/download`);
                      window.open((res as any).url, "_blank");
                    } catch { /* ignore */ }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border hover:bg-surface-secondary transition-colors text-left max-w-[240px]"
                >
                  {isImage ? (
                    <Paperclip className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                  ) : (
                    <FileText className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text truncate">
                      {att.filename ?? "Attachment"}
                    </p>
                    {sizeLabel && (
                      <p className="text-[10px] text-text-tertiary">{sizeLabel}</p>
                    )}
                  </div>
                  <Download className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}

        {/* Meta info row */}
        <div className="flex items-center gap-2 mt-0.5 px-1">
          {message.isEdited && (
            <button
              onClick={handleToggleHistory}
              className="text-[10px] text-text-tertiary hover:text-text-secondary flex items-center gap-0.5"
            >
              {t("messages.edited")}
              <History className="h-2.5 w-2.5" aria-hidden="true" />
            </button>
          )}
          {isAssistant && totalTokens > 0 && (
            <span className="text-[10px] text-text-tertiary">
              {totalTokens.toLocaleString()} tokens
              {(message.costCents ?? 0) > 0 && ` ($${((message.costCents ?? 0) / 100).toFixed(4)})`}
            </span>
          )}
        </div>

        {/* Edit history panel */}
        {showHistory && (
          <div className="mt-2 p-3 rounded-xl bg-surface border border-border max-w-full min-w-[280px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text">
                {t("messages.editHistory", { defaultValue: "Edit History" })}
                {editHistory.length > 0 && (
                  <span className="ml-1 text-text-tertiary font-normal">
                    ({t("messages.revisionCount", { count: editHistory.length, defaultValue: `${editHistory.length} revision(s)` })})
                  </span>
                )}
              </span>
              <button onClick={() => setShowHistory(false)} className="text-text-tertiary hover:text-text p-1 rounded" aria-label={t("actions.close", { defaultValue: "Close" })}>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            {historyLoading ? (
              <div className="py-3 text-center text-xs text-text-tertiary">{t("common.loading")}</div>
            ) : editHistory.length === 0 ? (
              <div className="py-3 text-center text-xs text-text-tertiary">{t("messages.noVersions", { defaultValue: "No previous versions found." })}</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {/* Current version */}
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-primary">{t("messages.currentVersion", { defaultValue: "Current version" })}</span>
                  </div>
                  <p className="text-text whitespace-pre-wrap line-clamp-4">{message.content}</p>
                </div>
                {/* Previous versions, newest first */}
                {[...editHistory].reverse().map((entry, i) => {
                  const versionNum = editHistory.length - i;
                  return (
                    <div key={i} className="p-2 rounded-lg bg-surface-secondary text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-text-tertiary">{t("messages.version", { number: versionNum, defaultValue: `Version ${versionNum}` })}</span>
                        <span className="text-[10px] text-text-tertiary">
                          {formatDistanceToNow(new Date(entry.editedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-text-secondary whitespace-pre-wrap line-clamp-4">{entry.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions - visible by default on touch devices, hover-reveal on desktop */}
        {!isEditing && (
          <div className="flex items-center gap-1 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="text-text-tertiary hover:text-text-secondary p-1 rounded"
              aria-label={t("messages.copy", { defaultValue: "Copy message" })}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
            {isAssistant && onRate && (
              <>
                <button
                  onClick={() => onRate(message.id, 1)}
                  className={clsx(
                    "p-1 rounded",
                    message.rating === "up"
                      ? "text-primary"
                      : "text-text-tertiary hover:text-success",
                  )}
                  aria-label={t("messages.rateUp", { defaultValue: "Good response" })}
                  aria-pressed={message.rating === "up"}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => onRate(message.id, -1)}
                  className={clsx(
                    "p-1 rounded",
                    message.rating === "down"
                      ? "text-danger"
                      : "text-text-tertiary hover:text-danger",
                  )}
                  aria-label={t("messages.rateDown", { defaultValue: "Bad response" })}
                  aria-pressed={message.rating === "down"}
                >
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
            {isAssistant && ttsSupported && message.content && (
              <button
                onClick={handleSpeak}
                className={clsx(
                  "p-1 rounded transition-colors",
                  isSpeaking
                    ? "text-primary hover:text-primary/80"
                    : "text-text-tertiary hover:text-text-secondary",
                )}
                aria-label={isSpeaking ? t("messages.stopListening", { defaultValue: "Stop listening" }) : t("messages.listen", { defaultValue: "Listen" })}
              >
                {isSpeaking ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            )}
            {isAssistant && onRerun && (
              <div className="relative" ref={modelSelectorRef}>
                <button
                  onClick={() => onRerun(message.id)}
                  className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                  aria-label={t("messages.rerun", { defaultValue: "Re-run" })}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                  aria-label={t("messages.rerunWithModel", { defaultValue: "Replay with different model" })}
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {showModelSelector && (
                  <div className="absolute bottom-full left-0 mb-1 w-56 py-1 bg-surface border border-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {t("messages.rerunWithModel", { defaultValue: "Replay with different model" })}
                    </div>
                    {availableModels.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-tertiary">{t("common.loading")}</div>
                    )}
                    {availableModels.map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onRerun(message.id, m.modelIdExternal);
                          setShowModelSelector(false);
                        }}
                        className={clsx(
                          "w-full text-left px-3 py-1.5 text-xs hover:bg-surface-secondary transition-colors",
                          m.modelIdExternal === message.modelId
                            ? "text-primary font-medium"
                            : "text-text",
                        )}
                      >
                        {m.name}
                        {m.modelIdExternal === message.modelId && (
                          <span className="ml-1 text-[10px] text-text-tertiary">({t("messages.currentModel", { defaultValue: "current" })})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isUser && onEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                aria-label={t("messages.edit", { defaultValue: "Edit message" })}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {onNote && (
              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                aria-label={t("messages.addNote", { defaultValue: "Add note" })}
              >
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {onFork && (
              <button
                onClick={() => onFork(message.id)}
                className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                aria-label={t("messages.fork", { defaultValue: "Fork from here" })}
              >
                <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Note input */}
        {showNoteInput && onNote && (
          <div className="mt-2 flex items-center gap-2 w-full max-w-[400px]">
            <input
              autoFocus
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && noteContent.trim()) {
                  onNote(message.id, noteContent.trim());
                  setNoteContent("");
                  setShowNoteInput(false);
                }
                if (e.key === "Escape") setShowNoteInput(false);
              }}
              placeholder={t("messages.notePlaceholder")}
              className="flex-1 h-7 px-2 text-xs bg-surface border border-border rounded-lg text-text placeholder:text-text-tertiary"
            />
            <button
              onClick={() => {
                if (noteContent.trim()) {
                  onNote(message.id, noteContent.trim());
                  setNoteContent("");
                  setShowNoteInput(false);
                }
              }}
              className="text-xs text-primary hover:text-primary-dark font-medium"
            >
              {t("common.save")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
