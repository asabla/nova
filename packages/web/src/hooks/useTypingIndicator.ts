import { useCallback, useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useWSStore } from "../stores/ws.store";
import { useAuthStore } from "../stores/auth.store";

const TYPING_DEBOUNCE_MS = 3000;

/**
 * Hook that manages typing indicator state for a conversation.
 *
 * - Call `onKeystroke()` from the input's onChange handler.
 * - The hook emits "typing.start" on the first keystroke and auto-sends
 *   "typing.stop" after 3 seconds of inactivity (debounced).
 * - Call `stopTyping()` explicitly when the user sends a message.
 * - Returns `typingUserIds` — the set of *other* users currently typing.
 */
export function useTypingIndicator(conversationId: string) {
  const { sendTyping } = useWebSocket();
  const currentUser = useAuthStore((s) => s.user);
  const typingUserIds = useWSStore((s) => {
    const set = s.typingUsers.get(conversationId);
    if (!set || !currentUser) return set;
    // Exclude the current user from the returned set
    const filtered = new Set(set);
    filtered.delete(currentUser.id);
    return filtered.size > 0 ? filtered : undefined;
  });

  const isTypingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const stopTyping = useCallback(() => {
    clearDebounce();
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(conversationId, false);
    }
  }, [conversationId, sendTyping, clearDebounce]);

  const onKeystroke = useCallback(() => {
    // Emit typing.start on the first keystroke
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(conversationId, true);
    }

    // Reset the debounce timer — after 3s of silence we auto-stop
    clearDebounce();
    debounceTimerRef.current = setTimeout(() => {
      stopTyping();
    }, TYPING_DEBOUNCE_MS);
  }, [conversationId, sendTyping, clearDebounce, stopTyping]);

  // Clean up on unmount or conversation change
  useEffect(() => {
    return () => {
      clearDebounce();
      if (isTypingRef.current) {
        sendTyping(conversationId, false);
        isTypingRef.current = false;
      }
    };
  }, [conversationId, sendTyping, clearDebounce]);

  return { onKeystroke, stopTyping, typingUserIds };
}
