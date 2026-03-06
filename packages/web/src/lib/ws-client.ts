import ReconnectingWebSocket from "reconnecting-websocket";
import type { ServerWSEvent } from "@nova/shared/types";

let ws: ReconnectingWebSocket | null = null;
type Listener = (event: ServerWSEvent) => void;
const listeners = new Set<Listener>();

export function connectWebSocket() {
  if (ws) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new ReconnectingWebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as ServerWSEvent;
      for (const listener of listeners) {
        listener(msg);
      }
    } catch {
      // Ignore malformed messages
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
