import { Hono } from "hono";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { agents } from "@nova/shared/schemas";
import { chatCompletion, resolveModelExternalId } from "../lib/litellm";
import { writeAuditLog } from "../services/audit.service";

const webhookRoutes = new Hono<AppContext>();

// Public agent webhook endpoint (story #106)
// No auth required - uses webhook secret for validation
webhookRoutes.post("/agents/:webhookId", async (c) => {
  const webhookId = c.req.param("webhookId");
  const secret = c.req.header("x-webhook-secret") ?? c.req.query("secret");

  // Find agent by webhookUrl containing the webhook ID
  const allAgents = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.isEnabled, true),
      isNull(agents.deletedAt),
    ));

  const agent = allAgents.find((a) => {
    const webhookUrl = a.webhookUrl as string | null;
    return webhookUrl?.includes(webhookId);
  });

  if (!agent) {
    return c.json({ error: "Agent not found or webhook not configured" }, 404);
  }

  // Parse input
  const body = await c.req.json().catch(() => ({}));
  const input = (body as any).input ?? (body as any).message ?? (body as any).text ?? JSON.stringify(body);

  // Build messages
  const messages: Array<{ role: string; content: string }> = [];
  if (agent.systemPrompt) {
    messages.push({ role: "system", content: agent.systemPrompt });
  }
  messages.push({ role: "user", content: String(input) });

  const modelParams = (agent.modelParams as Record<string, unknown>) ?? {};
  const resolvedModel = await resolveModelExternalId(agent.orgId, agent.modelId);

  try {
    const result = await chatCompletion({
      model: resolvedModel,
      messages,
      temperature: modelParams.temperature as number | undefined,
      max_tokens: modelParams.maxTokens as number | undefined,
      orgId: agent.orgId,
    });

    await writeAuditLog({
      orgId: agent.orgId,
      actorId: "webhook",
      actorType: "system",
      action: "agent.webhook.trigger",
      resourceType: "agent",
      resourceId: agent.id,
    });

    return c.json({
      agent_id: agent.id,
      agent_name: agent.name,
      content: result.choices?.[0]?.message?.content ?? "",
      model: result.model,
      usage: result.usage,
    });
  } catch (err: any) {
    return c.json({ error: err.message ?? "Agent execution failed" }, 500);
  }
});

// Email forwarding webhook (story #217)
webhookRoutes.post("/email/inbound", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { from, to, subject, text, html } = body as any;

  // Extract org from the to address (e.g., agent-id@nova.example.com)
  const toAddress = String(to ?? "");
  const agentIdMatch = toAddress.match(/^([a-f0-9-]+)@/i);

  if (!agentIdMatch) {
    return c.json({ error: "Invalid recipient address" }, 400);
  }

  const agentId = agentIdMatch[1];
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.isEnabled, true), isNull(agents.deletedAt)));

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const emailContent = `From: ${from}\nSubject: ${subject}\n\n${text ?? html ?? ""}`;

  const messages: Array<{ role: string; content: string }> = [];
  if (agent.systemPrompt) {
    messages.push({ role: "system", content: agent.systemPrompt });
  }
  messages.push({ role: "user", content: `Process this email:\n\n${emailContent}` });

  const resolvedEmailModel = await resolveModelExternalId(agent.orgId, agent.modelId);

  try {
    const result = await chatCompletion({
      model: resolvedEmailModel,
      messages,
      orgId: agent.orgId,
    });

    await writeAuditLog({
      orgId: agent.orgId,
      actorId: "email-webhook",
      actorType: "system",
      action: "agent.email.process",
      resourceType: "agent",
      resourceId: agent.id,
      details: { from, subject },
    });

    return c.json({
      status: "processed",
      agent_id: agent.id,
      response: result.choices?.[0]?.message?.content ?? "",
    });
  } catch (err: any) {
    return c.json({ error: err.message ?? "Email processing failed" }, 500);
  }
});

// Stripe webhook handler (Story #16)
webhookRoutes.post("/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const body = await c.req.text();

  try {
    const { billingService } = await import("../services/billing.service");
    const result = await billingService.handleStripeWebhook(body, signature);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message ?? "Webhook processing failed" }, 400);
  }
});

export { webhookRoutes };
