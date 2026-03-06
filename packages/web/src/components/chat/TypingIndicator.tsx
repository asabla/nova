import { useWSStore } from "../../stores/ws.store";
import { Avatar } from "../ui/Avatar";

interface TypingIndicatorProps {
  conversationId: string;
}

export function TypingIndicator({ conversationId }: TypingIndicatorProps) {
  const typingUsers = useWSStore((s) => s.typingUsers.get(conversationId));

  if (!typingUsers || typingUsers.size === 0) return null;

  const users = Array.from(typingUsers);

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-tertiary">
      <div className="flex -space-x-1">
        {users.slice(0, 3).map((userId) => (
          <Avatar key={userId} name={userId} size="xs" />
        ))}
      </div>
      <span>
        {users.length === 1
          ? "Someone is typing..."
          : `${users.length} people are typing...`}
      </span>
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 bg-text-tertiary rounded-full animate-bounce" />
        <span className="h-1.5 w-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.15s]" />
        <span className="h-1.5 w-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
