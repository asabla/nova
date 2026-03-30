import { eq } from "drizzle-orm";
import { db } from "../db";
import { organisations, orgSettings } from "@nova/shared/schemas";

const ORG_SETTINGS: Record<string, string> = {
  defaultModel: "gpt-5.4",
  maxTokensPerMessage: "4096",
  maxMessagesPerConversation: "1000",
  maxFileSizeMb: "50",
  allowedFileTypes: "image/png,image/jpeg,image/gif,application/pdf,text/plain,text/markdown",
};

export async function seedOrg(): Promise<string> {
  const [org] = await db
    .insert(organisations)
    .values({ name: "NOVA", slug: "nova" })
    .onConflictDoNothing()
    .returning();

  const orgId = org?.id ?? (await db.select().from(organisations).where(eq(organisations.slug, "nova")).then((r) => r[0]!.id));
  console.log(`  Org: NOVA (${orgId})`);

  for (const [key, value] of Object.entries(ORG_SETTINGS)) {
    await db.insert(orgSettings).values({ orgId, key, value }).onConflictDoNothing();
  }
  console.log("  Org settings: OK");

  return orgId;
}
