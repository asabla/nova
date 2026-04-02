import ReconnectingWebSocket from "reconnecting-websocket";
import type { ServerWSEvent } from "@nova/shared/types";
import { useWSStore } from "../stores/ws.store";

let ws: ReconnectingWebSocket | null = null;
type Listener = (event: ServerWSEvent) => void;
const listeners = new Set<Listener>();

export function connectWebSocket() {
  if (ws) return;

  useWSStore.getState().setStatus("connecting");

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new ReconnectingWebSocket(`${protocol}//${window.location.host}/ws`, [], {
    debug: !!import.meta.env.DEV,
  });

  ws.onopen = () => {
    useWSStore.getState().setStatus("connected");
  };

  ws.onclose = () => {
    // reconnecting-websocket will auto-reconnect; only set "disconnected" on intentional close
    if (ws) {
      useWSStore.getState().setStatus("reconnecting");
    }
  };

  ws.onerror = () => {
    useWSStore.getState().setStatus("reconnecting");
  };

  ws.onmessage = (event) => {
    // Any message received means the connection is alive
    if (useWSStore.getState().status !== "connected") {
      useWSStore.getState().setStatus("connected");
    }
    try {
      const raw = JSON.parse(event.data) as { type: string };
      // Skip internal control messages
      if (raw.type === "connected") return;
      const msg = raw as ServerWSEvent;
      for (const listener of listeners) {
        listener(msg);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[ws] Malformed message:", event.data, err);
      }
    }
  };
}

export function disconnectWebSocket() {
  ws?.close();
  ws = null;
}

export function onWsMessage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sendWsMessage(type: string, payload: Record<string, unknown>) {
  ws?.send(JSON.stringify({ type, ...payload }));
}

export function getWsReadyState(): number {
  return ws?.readyState ?? WebSocket.CLOSED;
}

// --- Message Draft Preservation (Story #202) ---
// Saves in-progress drafts to localStorage so they survive disconnects/refreshes.

const DRAFT_KEY = "nova:message-drafts";

interface DraftEntry {
  conversationId: string;
  text: string;
  updatedAt: number;
}

export function saveDraft(conversationId: string, text: string) {
  try {
    const drafts = loadAllDrafts();
    if (text.trim()) {
      drafts[conversationId] = { conversationId, text, updatedAt: Date.now() };
    } else {
      delete drafts[conversationId];
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    // Storage full or unavailable
  }
}

export function loadDraft(conversationId: string): string {
  try {
    const drafts = loadAllDrafts();
    return drafts[conversationId]?.text ?? "";
  } catch {
    return "";
  }
}

export function clearDraft(conversationId: string) {
  try {
    const drafts = loadAllDrafts();
    delete drafts[conversationId];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore
  }
}

function loadAllDrafts(): Record<string, DraftEntry> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const drafts = JSON.parse(raw) as Record<string, DraftEntry>;
    // Clean up entries older than 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(drafts)) {
      if (drafts[key].updatedAt < cutoff) delete drafts[key];
    }
    return drafts;
  } catch {
    return {};
  }
}

// --- Pending Message Queue (Story #202) ---
// Queue messages when offline and auto-send on reconnect.

interface PendingMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
}

const PENDING_KEY = "nova:pending-messages";

export function queuePendingMessage(conversationId: string, content: string): string {
  const id = crypto.randomUUID();
  try {
    const pending = loadPendingMessages();
    pending.push({ id, conversationId, content, timestamp: Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage unavailable
  }
  return id;
}

export function loadPendingMessages(): PendingMessage[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removePendingMessage(id: string) {
  try {
    const pending = loadPendingMessages().filter((m) => m.id !== id);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Ignore
  }
}

export function clearPendingMessages(conversationId: string) {
  try {
    const pending = loadPendingMessages().filter((m) => m.conversationId !== conversationId);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Ignore
  }
}
