import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectWebSocket, disconnectWebSocket, onWsMessage, sendWsMessage } from "../lib/ws-client";
import { useWSStore } from "../stores/ws.store";
import { useAuthStore } from "../stores/auth.store";
import { queryKeys } from "../lib/query-keys";
import type { ServerWSEvent } from "@nova/shared/types";

export function useWebSocket() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setStatus = useWSStore((s) => s.setStatus);
  const setTyping = useWSStore((s) => s.setTyping);

  useEffect(() => {
    if (!user) return;

    setStatus("connecting");
    connectWebSocket();
    setStatus("connected");

    const unsubscribe = onWsMessage((event: ServerWSEvent) => {
      switch (event.type) {
        case "typing.start":
          setTyping(event.conversationId, event.userId, true);
          break;
        case "typing.stop":
          setTyping(event.conversationId, event.userId, false);
          break;
        case "message.new":
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.messages(event.conversationId),
          });
          break;
        case "conversation.updated":
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.detail(event.conversationId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.all,
          });
          break;
        case "notification.new":
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.all,
          });
          break;
      }
    });

    return () => {
      unsubscribe();
      disconnectWebSocket();
      setStatus("disconnected");
    };
  }, [user, setStatus, setTyping, queryClient]);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    sendWsMessage(isTyping ? "typing.start" : "typing.stop", { conversationId });
  }, []);

  return { sendTyping };
}
