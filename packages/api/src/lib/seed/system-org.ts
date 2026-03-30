import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { organisations, orgSettings } from "@nova/shared/schemas";
import { getProviderDefs } from "./data/provider-defs";

export async function seedSystemOrg(): Promise<string> {
  // Create or ensure system org exists with isSystemOrg flag
  const [org] = await db
    .insert(organisations)
    .values({ name: "System", slug: "system", isSystemOrg: true })
    .onConflictDoUpdate({
      target: [organisations.slug],
      set: { isSystemOrg: true, updatedAt: new Date() },
    })
    .returning();

  const systemOrgId = org!.id;
  console.log(`  System org: ${systemOrgId}`);

  // Seed platform-level providers into orgSettings (what the admin portal reads)
  const providerDefs = getProviderDefs();
  const platformProviders = providerDefs.map((p) => ({
    id: crypto.randomUUID(),
    name: p.name,
    type: p.type,
    apiKey: p.apiKey || undefined,
    baseUrl: p.apiBaseUrl,
    createdAt: new Date().toISOString(),
  }));

  const value = JSON.stringify(platformProviders);

  const [existing] = await db
    .select()
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, systemOrgId), eq(orgSettings.key, "model_providers")));

  if (existing) {
    await db
      .update(orgSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(orgSettings.id, existing.id));
  } else {
    await db.insert(orgSettings).values({ orgId: systemOrgId, key: "model_providers", value });
  }

  console.log(`  Platform providers: ${platformProviders.length} configured`);
  return systemOrgId;
}
