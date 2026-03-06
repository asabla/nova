import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, ThumbsUp, ThumbsDown, Pencil, StickyNote } from "lucide-react";
import { clsx } from "clsx";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { Avatar } from "../ui/Avatar";

interface MessageBubbleProps {
  message: {
    id: string;
    senderType: string;
    senderUserId?: string | null;
    content?: string | null;
    isEdited?: boolean;
    createdAt: string;
    status?: string;
  };
  userName?: string;
  onRate?: (messageId: string, rating: 1 | -1) => void;
  onEdit?: (messageId: string) => void;
}

export function MessageBubble({ message, userName, onRate, onEdit }: MessageBubbleProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isUser = message.senderType === "user";
  const isAssistant = message.senderType === "assistant";

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

        {message.isEdited && (
          <span className="text-[10px] text-text-tertiary mt-0.5 px-1">(edited)</span>
        )}

        {/* Actions */}
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
              <button onClick={() => onRate(message.id, 1)} className="text-text-tertiary hover:text-success p-1 rounded">
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onRate(message.id, -1)} className="text-text-tertiary hover:text-danger p-1 rounded">
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {isUser && onEdit && (
            <button onClick={() => onEdit(message.id)} className="text-text-tertiary hover:text-text-secondary p-1 rounded">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
