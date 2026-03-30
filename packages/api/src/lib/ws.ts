import type { ServerWebSocket } from "bun";
import { redisSub, redisPub } from "./redis";
import { logger } from "./logger";

export interface WSData {
  userId: string;
  orgId: string;
}

const connections = new Map<string, Set<ServerWebSocket<WSData>>>();

export function handleWsUpgrade(ws: ServerWebSocket<WSData>) {
  const { userId } = ws.data;
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);
  // Force a frame to be sent — confirms connection through proxy
  ws.send(JSON.stringify({ type: "connected" }));
}

export function handleWsClose(ws: ServerWebSocket<WSData>) {
  const { userId } = ws.data;
  const userConns = connections.get(userId);
  if (userConns) {
    userConns.delete(ws);
    if (userConns.size === 0) connections.delete(userId);
  }
}

export function handleWsMessage(ws: ServerWebSocket<WSData>, message: string) {
  try {
    const data = JSON.parse(message);

    if (data.type === "typing.start" || data.type === "typing.stop") {
      const event = {
        type: data.type,
        userId: ws.data.userId,
        conversationId: data.conversationId,
      };

      // Broadcast directly to local connections in the same org (exclude sender)
      broadcastToOrg(ws.data.orgId, event, ws.data.userId);

      // Publish to Redis for cross-instance delivery
      redisPub.publish("ws:broadcast", JSON.stringify({
        orgId: ws.data.orgId,
        excludeUserId: ws.data.userId,
        event,
      }));
    }

    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  } catch {
    // Ignore malformed messages
  }
}

export function sendToUser(userId: string, event: Record<string, unknown>) {
  const userConns = connections.get(userId);
  if (!userConns) return;
  const msg = JSON.stringify(event);
  for (const ws of userConns) {
    ws.send(msg);
  }
}

export function broadcastToOrg(orgId: string, event: Record<string, unknown>, excludeUserId?: string) {
  const msg = JSON.stringify(event);
  for (const [userId, conns] of connections) {
    if (userId === excludeUserId) continue;
    for (const ws of conns) {
      if (ws.data.orgId === orgId) {
        ws.send(msg);
      }
    }
  }
}

// Subscribe to Redis pub/sub for cross-instance messaging
export function initWsPubSub() {
  redisSub.subscribe("ws:broadcast", (err) => {
    if (err) logger.error({ err }, "Redis subscribe error");
  });

  redisSub.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);
      if (data.targetUserId) {
        sendToUser(data.targetUserId, data.event);
      } else if (data.orgId) {
        broadcastToOrg(data.orgId, data.event, data.excludeUserId);
      }
    } catch {
      // Ignore malformed pubsub messages
    }
  });
}
