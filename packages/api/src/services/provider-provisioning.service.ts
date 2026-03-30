import { eq, and } from "drizzle-orm";
import { db } from "../lib/db";
import { organisations, orgSettings, modelProviders, models } from "@nova/shared/schemas";

// Default models per provider type — used when provisioning platform providers to orgs
const MODEL_CATALOG: Record<string, { name: string; modelIdExternal: string; capabilities: string[]; contextWindow: number; isDefault?: boolean; modelParams: Record<string, unknown> | null }[]> = {
  openai: [
    { name: "GPT-5.4", modelIdExternal: "gpt-5.4", capabilities: ["chat", "vision", "reasoning"], contextWindow: 128000, isDefault: true, modelParams: { dropParams: ["temperature", "top_p", "presence_penalty", "frequency_penalty", "logprobs", "top_logprobs", "parallel_tool_calls", "max_tokens"] } },
    { name: "Text Embedding 3 Small", modelIdExternal: "text-embedding-3-small", capabilities: ["embeddings"], contextWindow: 8192, modelParams: null },
  ],
  anthropic: [
    { name: "Claude Sonnet 5.6", modelIdExternal: "claude-sonnet-5-6", capabilities: ["chat", "vision"], contextWindow: 200000, modelParams: null },
  ],
};

interface PlatformProvider {
  id: string;
  name: string;
  type: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Reads platform providers from system org settings and provisions them into an org's
 * modelProviders + models tables. Skips providers that already exist (by name).
 * Returns the number of providers and models provisioned.
 */
export async function provisionPlatformProviders(orgId: string): Promise<{ providers: number; models: number }> {
  // Find platform providers from system org settings
  const [systemOrg] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isSystemOrg, true));

  if (!systemOrg) return { providers: 0, models: 0 };

  const [setting] = await db.select({ value: orgSettings.value })
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, systemOrg.id), eq(orgSettings.key, "model_providers")));

  if (!setting?.value) return { providers: 0, models: 0 };

  let platformProviders: PlatformProvider[];
  try {
    platformProviders = JSON.parse(setting.value);
  } catch {
    return { providers: 0, models: 0 };
  }

  let providerCount = 0;
  let modelCount = 0;
  let isFirstProvider = true;

  for (const pp of platformProviders) {
    // Upsert provider
    const [provider] = await db
      .insert(modelProviders)
      .values({
        orgId,
        name: pp.name,
        type: pp.type,
        apiBaseUrl: pp.baseUrl ?? null,
        apiKeyEncrypted: pp.apiKey ?? null,
      })
      .onConflictDoUpdate({
        target: [modelProviders.orgId, modelProviders.name],
        set: { type: pp.type, apiBaseUrl: pp.baseUrl ?? null, apiKeyEncrypted: pp.apiKey ?? null, updatedAt: new Date() },
      })
      .returning();

    if (!provider) continue;
    providerCount++;

    // Create models from catalog
    const catalogModels = MODEL_CATALOG[pp.type] ?? [];
    for (const m of catalogModels) {
      await db
        .insert(models)
        .values({
          orgId,
          modelProviderId: provider.id,
          name: m.name,
          modelIdExternal: m.modelIdExternal,
          capabilities: m.capabilities,
          contextWindow: m.contextWindow,
          isDefault: isFirstProvider ? (m.isDefault ?? false) : false,
          modelParams: m.modelParams,
        })
        .onConflictDoUpdate({
          target: [models.orgId, models.modelIdExternal],
          set: {
            name: m.name,
            modelProviderId: provider.id,
            capabilities: m.capabilities,
            contextWindow: m.contextWindow,
            modelParams: m.modelParams,
            updatedAt: new Date(),
          },
        });
      modelCount++;
    }
    isFirstProvider = false;
  }

  return { providers: providerCount, models: modelCount };
}
