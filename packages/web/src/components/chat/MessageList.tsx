import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";
import { TypingIndicator } from "./TypingIndicator";
import type { ActiveTool, AgentFlowState } from "../../hooks/useSSE";
import { useBranchStore, getActivePath } from "../../stores/branch.store";

interface MessageListProps {
  messages: any[];
  artifactsByMessageId?: Map<string, any[]>;
  streamingContent?: string;
  isStreaming?: boolean;
  activeTools?: ActiveTool[];
  agentFlow?: AgentFlowState;
  userName?: string;
  conversationId?: string;
  onRate?: (messageId: string, rating: 1 | -1) => void;
  onEdit?: (messageId: string, content: string) => void;
  onEditAndRerun?: (messageId: string, content: string) => void;
  onRerun?: (messageId: string, modelId?: string) => void;
  onNote?: (messageId: string, content: string) => void;
  onFork?: (messageId: string) => void;
  onRetryStep?: (stepId: string) => void;
}

const YT_ID_REGEX = /(?:youtube\.com\/watch\?[^\s)]*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function MessageList({ messages, artifactsByMessageId, streamingContent, isStreaming, activeTools, agentFlow, userName, conversationId, onRate, onEdit, onEditAndRerun, onRerun, onNote, onFork, onRetryStep }: MessageListProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Extract YouTube video ID from any message in the conversation for timestamp auto-linking
  const youtubeVideoId = useMemo(() => {
    for (const msg of messages) {
      const match = msg.content?.match(YT_ID_REGEX);
      if (match) return match[1];
    }
    return undefined;
  }, [messages]);

  // Compute active branch path through the message tree
  const activeChildren = useBranchStore((s) => s.activeChildren);
  const setActiveChild = useBranchStore((s) => s.setActiveChild);
  const handleBranchSwitch = useCallback((parentId: string, siblingId: string) => {
    if (conversationId) setActiveChild(conversationId, parentId, siblingId);
  }, [conversationId, setActiveChild]);
  const activePath = useMemo(
    () => getActivePath(conversationId ?? "", messages, activeChildren),
    [conversationId, messages, activeChildren],
  );

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
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const newMessagesArrived = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNearBottomRef.current) {
      if (isStreaming) {
        // During streaming: use instant scroll coalesced via rAF to avoid overlapping animations
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            const container = scrollContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
            rafRef.current = null;
          });
        }
      } else {
        // New messages (not streaming): smooth scroll
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } else if (newMessagesArrived) {
      setShowNewMessages(true);
    }
  }, [messages.length, streamingContent, isStreaming]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto relative"
      style={{ overflowAnchor: "auto" }}
      role="log"
      aria-live="polite"
    >
      <div className="max-w-5xl mx-auto py-4 px-4">
        {activePath.length === 0 && !isStreaming && (
          <div className="text-center py-16 text-sm text-text-tertiary">
            {t("messages.empty", { defaultValue: "No messages yet. Start the conversation below." })}
          </div>
        )}

        {activePath
          .filter((msg: any) => msg.status !== "streaming")
          .map((msg: any) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            artifacts={artifactsByMessageId?.get(msg.id)}
            userName={userName}
            youtubeVideoId={youtubeVideoId}
            onRate={onRate}
            onEdit={onEdit}
            onEditAndRerun={onEditAndRerun}
            onRerun={onRerun}
            onNote={onNote}
            onFork={onFork}
            onRetryStep={onRetryStep}
            onBranchSwitch={handleBranchSwitch}
            allMessages={messages}
          />
        ))}

        {isStreaming && streamingContent !== undefined && (
          <StreamingMessage content={streamingContent} activeTools={activeTools} agentFlow={agentFlow} conversationId={conversationId} youtubeVideoId={youtubeVideoId} />
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
