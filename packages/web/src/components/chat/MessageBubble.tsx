import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, ThumbsUp, ThumbsDown, Pencil, RotateCcw, History, X, Send, StickyNote } from "lucide-react";
import { clsx } from "clsx";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { Avatar } from "../ui/Avatar";
import { formatDistanceToNow } from "date-fns";

interface EditHistoryEntry {
  content: string;
  editedAt: string;
}

interface MessageBubbleProps {
  message: {
    id: string;
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
  };
  userName?: string;
  onRate?: (messageId: string, rating: 1 | -1) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRerun?: (messageId: string) => void;
  onNote?: (messageId: string, content: string) => void;
}

export function MessageBubble({ message, userName, onRate, onEdit, onRerun, onNote }: MessageBubbleProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const isUser = message.senderType === "user";
  const isAssistant = message.senderType === "assistant";

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content && onEdit) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditContent(message.content ?? "");
    setIsEditing(false);
  };

  const editHistory = (message.editHistory as EditHistoryEntry[]) ?? [];
  const totalTokens = (message.tokenCountPrompt ?? 0) + (message.tokenCountCompletion ?? 0);

  return (
    <div className={clsx("group flex gap-3 px-4 py-4", isUser ? "flex-row-reverse" : "")}>
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <Avatar name={userName} size="sm" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>

      <div className={clsx("flex flex-col max-w-[80%]", isUser ? "items-end" : "items-start")}>
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
                <Send className="h-3 w-3" /> Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={clsx(
              "rounded-2xl px-4 py-2.5",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-surface-secondary border border-border rounded-tl-sm",
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
            ) : null}
          </div>
        )}

        {/* Meta info row */}
        <div className="flex items-center gap-2 mt-0.5 px-1">
          {message.isEdited && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-[10px] text-text-tertiary hover:text-text-secondary flex items-center gap-0.5"
            >
              (edited)
              {editHistory.length > 0 && <History className="h-2.5 w-2.5" />}
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
        {showHistory && editHistory.length > 0 && (
          <div className="mt-2 p-3 rounded-xl bg-surface border border-border max-w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text">Edit History</span>
              <button onClick={() => setShowHistory(false)} className="text-text-tertiary hover:text-text">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {editHistory.map((entry, i) => (
                <div key={i} className="p-2 rounded-lg bg-surface-secondary text-xs">
                  <p className="text-text-secondary whitespace-pre-wrap line-clamp-3">{entry.content}</p>
                  <span className="text-[10px] text-text-tertiary mt-1 block">
                    {formatDistanceToNow(new Date(entry.editedAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="text-text-tertiary hover:text-text-secondary p-1 rounded"
              title={t("messages.copy")}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {isAssistant && onRate && (
              <>
                <button onClick={() => onRate(message.id, 1)} className="text-text-tertiary hover:text-success p-1 rounded" title="Good response">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => onRate(message.id, -1)} className="text-text-tertiary hover:text-danger p-1 rounded" title="Bad response">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {isAssistant && onRerun && (
              <button onClick={() => onRerun(message.id)} className="text-text-tertiary hover:text-text-secondary p-1 rounded" title="Re-run with different model">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {isUser && onEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                title="Edit message"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onNote && (
              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="text-text-tertiary hover:text-text-secondary p-1 rounded"
                title="Add note"
              >
                <StickyNote className="h-3.5 w-3.5" />
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
              placeholder="Add a private note..."
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
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
