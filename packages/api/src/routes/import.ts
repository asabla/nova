import { Hono } from "hono";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { conversations, messages } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";

const importRoutes = new Hono<AppContext>();

// Import from ChatGPT export (conversations.json)
importRoutes.post("/chatgpt", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = await c.req.json();

  if (!Array.isArray(body)) {
    return c.json({ error: "Expected an array of conversations" }, 400);
  }

  let imported = 0;
  let skipped = 0;

  for (const conv of body) {
    try {
      const title = conv.title ?? "Imported Conversation";

      const [newConv] = await db.insert(conversations).values({
        orgId,
        ownerId: userId,
        title,
      }).returning();

      // Extract messages from ChatGPT's mapping format
      const mapping = conv.mapping ?? {};
      const messageEntries = Object.values(mapping)
        .filter((m: any) => m?.message?.content?.parts?.length > 0)
        .sort((a: any, b: any) => (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0));

      for (const entry of messageEntries as any[]) {
        const msg = entry.message;
        if (!msg) continue;

        const content = msg.content?.parts?.filter((p: any) => typeof p === "string").join("\n") ?? "";
        if (!content.trim()) continue;

        const senderType = msg.author?.role === "user" ? "user" : msg.author?.role === "assistant" ? "assistant" : "system";

        await db.insert(messages).values({
          orgId,
          conversationId: newConv.id,
          senderType,
          content,
        });
      }

      imported++;
    } catch {
      skipped++;
    }
  }

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "import.chatgpt",
    resourceType: "conversation",
    details: { imported, skipped, total: body.length },
  });

  return c.json({ imported, skipped, total: body.length });
});

// Import from Claude.ai export
importRoutes.post("/claude", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = await c.req.json();

  if (!Array.isArray(body)) {
    return c.json({ error: "Expected an array of conversations" }, 400);
  }

  let imported = 0;
  let skipped = 0;

  for (const conv of body) {
    try {
      const [newConv] = await db.insert(conversations).values({
        orgId,
        ownerId: userId,
        title: conv.name ?? "Imported from Claude",
      }).returning();

      for (const msg of conv.chat_messages ?? []) {
        await db.insert(messages).values({
          orgId,
          conversationId: newConv.id,
          senderType: msg.sender === "human" ? "user" : "assistant",
          content: typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text),
        });
      }

      imported++;
    } catch {
      skipped++;
    }
  }

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "import.claude",
    resourceType: "conversation",
    details: { imported, skipped, total: body.length },
  });

  return c.json({ imported, skipped, total: body.length });
});

export { importRoutes };
