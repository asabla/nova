import { create } from "zustand";

interface WSState {
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  /** True once the WS has connected at least once this session */
  hasConnected: boolean;
  typingUsers: Map<string, Set<string>>;
  setStatus: (status: WSState["status"]) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

export const useWSStore = create<WSState>((set) => ({
  status: "disconnected",
  hasConnected: false,
  typingUsers: new Map(),
  setStatus: (status) =>
    set((state) => ({
      status,
      hasConnected: state.hasConnected || status === "connected",
    })),
  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const map = new Map(state.typingUsers);
      const users = new Set(map.get(conversationId) ?? []);
      if (isTyping) users.add(userId);
      else users.delete(userId);
      map.set(conversationId, users);
      return { typingUsers: map };
    }),
}));
