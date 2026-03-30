import { seedSystemOrg } from "./seed/system-org";
import { seedOrg } from "./seed/org";
import { seedUser, SEED_USER } from "./seed/user";
import { seedProviders } from "./seed/providers";
import { seedPrompts } from "./seed/prompts";
import { seedAgents } from "./seed/agents";
import { seedExploreTemplates } from "./seed-templates";
import { seedEvals } from "./seed/evals";

async function seed() {
  console.log("Seeding database...\n");

  // 1. System org (platform-level config for admin portal)
  await seedSystemOrg();

  // 2. Default org
  const orgId = await seedOrg();

  // 3. Admin user
  const { userId, cleanup } = await seedUser(orgId);

  // 4. Org-level providers + models
  await seedProviders(orgId);

  // 5. Prompt templates
  await seedPrompts(orgId, userId);

  // 6. Agents
  await seedAgents(orgId, userId);

  // 7. Explore templates
  await seedExploreTemplates(orgId, userId);

  // 8. System prompts & eval dimensions
  await seedEvals(orgId);

  // Done
  console.log("\n  Seed complete!");
  console.log(`\n  Login at http://localhost:5173`);
  console.log(`    Email:    ${SEED_USER.email}`);
  console.log(`    Password: ${SEED_USER.password}\n`);

  await cleanup();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
