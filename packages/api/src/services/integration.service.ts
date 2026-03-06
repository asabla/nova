import { db } from "../lib/db";
import { orgSettings } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";

export type IntegrationType = "slack" | "teams" | "email" | "google-drive" | "webhook";

export interface IntegrationConfig {
  type: IntegrationType;
  isEnabled: boolean;
  config: Record<string, unknown>;
  connectedAt?: string;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
}

const INTEGRATION_KEY_PREFIX = "integration:";

function integrationKey(type: IntegrationType): string {
  return `${INTEGRATION_KEY_PREFIX}${type}`;
}

function parseConfig(value: string): IntegrationConfig | null {
  try {
    return JSON.parse(value) as IntegrationConfig;
  } catch {
    return null;
  }
}

export const integrationService = {
  async listIntegrations(orgId: string): Promise<IntegrationConfig[]> {
    const rows = await db
      .select()
      .from(orgSettings)
      .where(and(eq(orgSettings.orgId, orgId), isNull(orgSettings.deletedAt)));

    return rows
      .filter((r) => r.key.startsWith(INTEGRATION_KEY_PREFIX))
      .map((r) => parseConfig(r.value))
      .filter((c): c is IntegrationConfig => c !== null);
  },

  async getIntegration(orgId: string, type: IntegrationType): Promise<IntegrationConfig | null> {
    const rows = await db
      .select()
      .from(orgSettings)
      .where(
        and(
          eq(orgSettings.orgId, orgId),
          eq(orgSettings.key, integrationKey(type)),
          isNull(orgSettings.deletedAt),
        ),
      );

    if (rows.length === 0) return null;
    return parseConfig(rows[0].value);
  },

  async upsertIntegration(
    orgId: string,
    type: IntegrationType,
    config: Record<string, unknown>,
    isEnabled: boolean = true,
  ): Promise<IntegrationConfig> {
    const existing = await this.getIntegration(orgId, type);

    const integrationConfig: IntegrationConfig = {
      type,
      isEnabled,
      config,
      connectedAt: existing?.connectedAt ?? new Date().toISOString(),
      lastTestedAt: existing?.lastTestedAt,
      lastTestSuccess: existing?.lastTestSuccess,
    };

    const value = JSON.stringify(integrationConfig);

    await db
      .insert(orgSettings)
      .values({ orgId, key: integrationKey(type), value })
      .onConflictDoUpdate({
        target: [orgSettings.orgId, orgSettings.key],
        set: { value, updatedAt: new Date() },
      });

    return integrationConfig;
  },

  async deleteIntegration(orgId: string, type: IntegrationType): Promise<void> {
    await db
      .update(orgSettings)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(orgSettings.orgId, orgId),
          eq(orgSettings.key, integrationKey(type)),
        ),
      );
  },

  async testIntegration(
    orgId: string,
    type: IntegrationType,
  ): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    const integration = await this.getIntegration(orgId, type);
    if (!integration) {
      return { success: false, message: "Integration not configured" };
    }

    if (!integration.isEnabled) {
      return { success: false, message: "Integration is disabled" };
    }

    let result: { success: boolean; message: string; details?: Record<string, unknown> };

    try {
      switch (type) {
        case "slack":
          result = await testSlack(integration.config);
          break;
        case "teams":
          result = await testTeams(integration.config);
          break;
        case "email":
          result = await testEmail(integration.config);
          break;
        case "google-drive":
          result = await testGoogleDrive(integration.config);
          break;
        case "webhook":
          result = await testWebhook(integration.config);
          break;
        default:
          result = { success: false, message: `Unknown integration type: ${type}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result = { success: false, message };
    }

    // Update last tested timestamp
    const updated: IntegrationConfig = {
      ...integration,
      lastTestedAt: new Date().toISOString(),
      lastTestSuccess: result.success,
    };

    await db
      .insert(orgSettings)
      .values({ orgId, key: integrationKey(type), value: JSON.stringify(updated) })
      .onConflictDoUpdate({
        target: [orgSettings.orgId, orgSettings.key],
        set: { value: JSON.stringify(updated), updatedAt: new Date() },
      });

    return result;
  },
};

// --- Test helpers ---

async function testSlack(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const webhookUrl = config.webhookUrl as string | undefined;
  if (!webhookUrl) {
    return { success: false, message: "Missing webhook URL" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "NOVA integration test - connection successful." }),
    });

    if (response.ok) {
      return { success: true, message: "Slack webhook is reachable. Test message sent." };
    }
    return { success: false, message: `Slack returned status ${response.status}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, message };
  }
}

async function testTeams(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const webhookUrl = config.webhookUrl as string | undefined;
  if (!webhookUrl) {
    return { success: false, message: "Missing webhook URL" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        summary: "NOVA Test",
        text: "NOVA integration test - connection successful.",
      }),
    });

    if (response.ok) {
      return { success: true, message: "Teams webhook is reachable. Test message sent." };
    }
    return { success: false, message: `Teams returned status ${response.status}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, message };
  }
}

async function testEmail(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const host = config.host as string | undefined;
  const port = config.port as number | undefined;

  if (!host || !port) {
    return { success: false, message: "Missing SMTP host or port" };
  }

  // For MVP, validate the config shape. Full SMTP connection test would require nodemailer.
  const requiredFields = ["host", "port", "from"];
  const missing = requiredFields.filter((f) => !config[f]);
  if (missing.length > 0) {
    return { success: false, message: `Missing required fields: ${missing.join(", ")}` };
  }

  return { success: true, message: `SMTP config looks valid (${host}:${port}). Full send test requires nodemailer.` };
}

async function testGoogleDrive(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const accessToken = config.accessToken as string | undefined;
  if (!accessToken) {
    return { success: false, message: "No access token. Complete OAuth flow first." };
  }

  try {
    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const data = (await response.json()) as { user?: { displayName?: string } };
      return {
        success: true,
        message: `Connected as ${data.user?.displayName ?? "unknown user"}`,
      };
    }
    return { success: false, message: `Google API returned status ${response.status}. Token may be expired.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, message };
  }
}

async function testWebhook(config: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const url = config.url as string | undefined;
  if (!url) {
    return { success: false, message: "Missing webhook URL" };
  }

  const method = (config.method as string) ?? "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(config.secret ? { "X-Webhook-Secret": config.secret as string } : {}),
      },
      body: JSON.stringify({ event: "test", timestamp: new Date().toISOString(), source: "nova" }),
    });

    if (response.ok || response.status < 500) {
      return { success: true, message: `Webhook endpoint responded with status ${response.status}` };
    }
    return { success: false, message: `Webhook returned server error: ${response.status}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { success: false, message };
  }
}
