import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWSStore } from "../../stores/ws.store";
import { Avatar } from "../ui/Avatar";
import { clsx } from "clsx";

export interface TypingUser {
  name: string;
  avatarUrl?: string;
}

interface TypingIndicatorProps {
  /** Pass explicit typing users (overrides WS store lookup) */
  typingUsers?: TypingUser[];
  /** Or pass conversationId to read from WS store */
  conversationId?: string;
}

export function TypingIndicator({ typingUsers: propUsers, conversationId }: TypingIndicatorProps) {
  const { t } = useTranslation();
  const storeTypingUserIds = useWSStore((s) =>
    conversationId ? s.typingUsers.get(conversationId) : undefined,
  );

  // Derive the display list: explicit prop takes priority, else map store IDs
  const users: TypingUser[] = propUsers
    ?? (storeTypingUserIds
      ? Array.from(storeTypingUserIds).map((id) => ({ name: id }))
      : []);

  const hasUsers = users.length > 0;

  // Fade in/out visibility with a short delay so the indicator doesn't flicker
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (hasUsers) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [hasUsers]);

  if (!visible) return null;

  const displayLabel = (() => {
    if (users.length === 0) return "";
    if (users.length === 1) {
      return t("typing.single", { name: users[0].name, defaultValue: "{{name}} is typing" });
    }
    if (users.length === 2) {
      return t("typing.double", {
        name1: users[0].name,
        name2: users[1].name,
        defaultValue: "{{name1}} and {{name2}} are typing",
      });
    }
    return t("typing.multiple", {
      name: users[0].name,
      count: users.length - 1,
      defaultValue: "{{name}} and {{count}} others are typing",
    });
  })();

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-4 py-2 text-xs text-text-tertiary transition-opacity duration-300",
        hasUsers ? "opacity-100" : "opacity-0",
      )}
      aria-live="polite"
      aria-label={displayLabel}
    >
      {/* Stacked avatars */}
      <div className="flex -space-x-1.5">
        {users.slice(0, 3).map((user) => (
          <Avatar
            key={user.name}
            name={user.name}
            src={user.avatarUrl}
            size="xs"
            className="ring-2 ring-surface"
          />
        ))}
      </div>

      {/* Label */}
      <span>{displayLabel}</span>

      {/* Animated dots */}
      <div className="flex gap-0.5 ml-0.5">
        <span className="h-1.5 w-1.5 bg-text-tertiary rounded-full animate-bounce" />
        <span className="h-1.5 w-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.15s]" />
        <span className="h-1.5 w-1.5 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
