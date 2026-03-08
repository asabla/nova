import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: any[];
  artifactsByMessageId?: Map<string, any[]>;
  streamingContent?: string;
  isStreaming?: boolean;
  userName?: string;
  conversationId?: string;
  onRate?: (messageId: string, rating: 1 | -1) => void;
  onEdit?: (messageId: string, content: string) => void;
  onEditAndRerun?: (messageId: string, content: string) => void;
  onRerun?: (messageId: string, modelId?: string) => void;
  onNote?: (messageId: string, content: string) => void;
  onFork?: (messageId: string) => void;
}

export function MessageList({ messages, artifactsByMessageId, streamingContent, isStreaming, userName, conversationId, onRate, onEdit, onEditAndRerun, onRerun, onNote, onFork }: MessageListProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  const NEAR_BOTTOM_THRESHOLD = 150;

  const checkIfNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowNewMessages(false);
    isNearBottomRef.current = true;
  }, []);

  // Track scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const nearBottom = checkIfNearBottom();
      isNearBottomRef.current = nearBottom;
      if (nearBottom) {
        setShowNewMessages(false);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [checkIfNearBottom]);

  // Auto-scroll on new messages / streaming content, or show "new messages" button
  useEffect(() => {
    const newMessagesArrived = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (newMessagesArrived) {
      setShowNewMessages(true);
    }
  }, [messages.length, streamingContent]);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto relative"
      role="log"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto py-4">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center py-16 text-sm text-text-tertiary">
            {t("messages.empty", { defaultValue: "No messages yet. Start the conversation below." })}
          </div>
        )}

        {messages.map((msg: any) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            artifacts={artifactsByMessageId?.get(msg.id)}
            userName={userName}
            onRate={onRate}
            onEdit={onEdit}
            onEditAndRerun={onEditAndRerun}
            onRerun={onRerun}
            onNote={onNote}
            onFork={onFork}
          />
        ))}

        {isStreaming && streamingContent !== undefined && (
          <StreamingMessage content={streamingContent} />
        )}

        {conversationId && (
          <TypingIndicator conversationId={conversationId} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating "New messages" button */}
      {showNewMessages && (
        <button
          onClick={scrollToBottom}
          className="sticky bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-full shadow-lg hover:bg-primary-dark transition-colors"
          aria-label={t("messages.newMessages", { defaultValue: "New messages" })}
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          {t("messages.newMessages", { defaultValue: "New messages" })}
        </button>
      )}
    </div>
  );
}
