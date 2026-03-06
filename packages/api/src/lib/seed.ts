import { db } from "./db";
import { organisations, orgSettings } from "@nova/shared/schemas";

async function seed() {
  console.log("Seeding database...");

  // Create default org
  const [org] = await db
    .insert(organisations)
    .values({
      name: "NOVA",
      slug: "nova",
    })
    .onConflictDoNothing()
    .returning();

  if (org) {
    console.log("Created org:", org.name);

    // Create org settings as key-value pairs
    const settings = {
      defaultModel: "gpt-4o",
      maxTokensPerMessage: "4096",
      maxMessagesPerConversation: "1000",
      maxFileSizeMb: "50",
      allowedFileTypes: "image/png,image/jpeg,image/gif,application/pdf,text/plain,text/markdown",
    };

    for (const [key, value] of Object.entries(settings)) {
      await db
        .insert(orgSettings)
        .values({ orgId: org.id, key, value })
        .onConflictDoNothing();
    }

    console.log("Created org settings");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
