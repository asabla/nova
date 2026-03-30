import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { modelProviders, models } from "@nova/shared/schemas";
import { getProviderDefs } from "./data/provider-defs";

export async function seedProviders(orgId: string): Promise<void> {
  const providerDefs = getProviderDefs();
  let totalModels = 0;

  for (const prov of providerDefs) {
    const [provider] = await db
      .insert(modelProviders)
      .values({
        orgId,
        name: prov.name,
        type: prov.type,
        apiBaseUrl: prov.apiBaseUrl,
        apiKeyEncrypted: prov.apiKey,
      })
      .onConflictDoUpdate({
        target: [modelProviders.orgId, modelProviders.name],
        set: { type: prov.type, apiBaseUrl: prov.apiBaseUrl, apiKeyEncrypted: prov.apiKey, updatedAt: new Date() },
      })
      .returning();

    const providerId = provider?.id ?? (await db.select().from(modelProviders).where(and(eq(modelProviders.orgId, orgId), eq(modelProviders.name, prov.name))).then((r) => r[0]!.id));

    for (const m of prov.models) {
      await db
        .insert(models)
        .values({
          orgId,
          modelProviderId: providerId,
          name: m.name,
          modelIdExternal: m.modelIdExternal,
          capabilities: m.capabilities,
          contextWindow: m.contextWindow,
          isDefault: m.isDefault ?? false,
          modelParams: m.modelParams,
        })
        .onConflictDoUpdate({
          target: [models.orgId, models.modelIdExternal],
          set: { name: m.name, capabilities: m.capabilities, contextWindow: m.contextWindow, isDefault: m.isDefault ?? false, modelParams: m.modelParams, updatedAt: new Date() },
        });
    }
    totalModels += prov.models.length;
  }

  console.log(`  Models: ${totalModels} registered (${providerDefs.length} providers)`);
}
