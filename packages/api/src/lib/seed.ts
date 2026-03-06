import { db } from "./db";
import { organisations, orgSettings, users } from "@nova/shared/schemas";

async function seed() {
  console.log("Seeding database...");

  // Create default org
  const [org] = await db
    .insert(organisations)
    .values({
      name: "NOVA",
      slug: "nova",
      plan: "free",
    })
    .onConflictDoNothing()
    .returning();

  if (org) {
    console.log("Created org:", org.name);

    // Create org settings
    await db
      .insert(orgSettings)
      .values({
        orgId: org.id,
        defaultModel: "gpt-4o",
        maxTokensPerMessage: 4096,
        maxMessagesPerConversation: 1000,
        allowedFileTypes: ["image/png", "image/jpeg", "image/gif", "application/pdf", "text/plain", "text/markdown"],
        maxFileSizeMb: 50,
      })
      .onConflictDoNothing();

    console.log("Created org settings");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
