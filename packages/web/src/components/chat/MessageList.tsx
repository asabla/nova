import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";

interface MessageListProps {
  messages: any[];
  streamingContent?: string;
  isStreaming?: boolean;
  userName?: string;
  onRate?: (messageId: string, rating: 1 | -1) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRerun?: (messageId: string) => void;
}

export function MessageList({ messages, streamingContent, isStreaming, userName, onRate, onEdit, onRerun }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-4">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center py-16 text-sm text-text-tertiary">
            No messages yet. Start the conversation below.
          </div>
        )}

        {messages.map((msg: any) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            userName={userName}
            onRate={onRate}
            onEdit={onEdit}
            onRerun={onRerun}
          />
        ))}

        {isStreaming && streamingContent !== undefined && (
          <StreamingMessage content={streamingContent} />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
