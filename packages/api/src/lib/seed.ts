import { eq } from "drizzle-orm";
import { db } from "./db";
import { organisations, orgSettings, users, userProfiles, modelProviders, models, agents, promptTemplates } from "@nova/shared/schemas";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as authSchema from "./auth-schema";

// Separate auth DB client (Better Auth tables)
const authClient = postgres(env.DATABASE_URL);
const authDb = drizzle(authClient, { schema: authSchema });

// ─── Config ──────────────────────────────────────────
const SEED_USER = {
  name: "Admin",
  email: "admin@nova.local",
  password: "Admin123!",
};

async function seed() {
  console.log("Seeding database...\n");

  // ─── 1. Organisation ──────────────────────────────
  const [org] = await db
    .insert(organisations)
    .values({ name: "NOVA", slug: "nova" })
    .onConflictDoNothing()
    .returning();

  const orgId = org?.id ?? (await db.select().from(organisations).where(eq(organisations.slug, "nova")).then((r) => r[0]!.id));
  console.log(`  Org: NOVA (${orgId})`);

  // Org settings
  const settings: Record<string, string> = {
    defaultModel: "lmstudio/gpt-oss:20b",
    maxTokensPerMessage: "4096",
    maxMessagesPerConversation: "1000",
    maxFileSizeMb: "50",
    allowedFileTypes: "image/png,image/jpeg,image/gif,application/pdf,text/plain,text/markdown",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.insert(orgSettings).values({ orgId, key, value }).onConflictDoNothing();
  }
  console.log("  Org settings: OK");

  // ─── 2. User (Better Auth + NOVA) ─────────────────
  const hashedPassword = await hashPassword(SEED_USER.password);

  // Check if Better Auth user already exists
  const existingAuthUsers = await authDb.select().from(authSchema.user).where(eq(authSchema.user.email, SEED_USER.email));
  let betterAuthId: string;

  if (existingAuthUsers.length > 0) {
    betterAuthId = existingAuthUsers[0].id;
    // Update password in case it changed
    await authDb
      .update(authSchema.account)
      .set({ password: hashedPassword })
      .where(eq(authSchema.account.userId, betterAuthId));
  } else {
    betterAuthId = crypto.randomUUID();

    await authDb.insert(authSchema.user).values({
      id: betterAuthId,
      name: SEED_USER.name,
      email: SEED_USER.email,
      emailVerified: true,
    });

    await authDb.insert(authSchema.account).values({
      id: crypto.randomUUID(),
      accountId: betterAuthId,
      providerId: "credential",
      userId: betterAuthId,
      password: hashedPassword,
    });
  }

  // NOVA users table
  const [novaUser] = await db
    .insert(users)
    .values({
      externalId: betterAuthId,
      email: SEED_USER.email,
      isSuperAdmin: true,
      lastLoginAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  const userId = novaUser?.id ?? (await db.select().from(users).where(eq(users.externalId, betterAuthId)).then((r) => r[0]!.id));

  // User profile (org-admin)
  await db
    .insert(userProfiles)
    .values({
      userId,
      orgId,
      displayName: SEED_USER.name,
      role: "org-admin",
      onboardingCompletedAt: new Date(),
    })
    .onConflictDoNothing();

  console.log(`  User: ${SEED_USER.email} / ${SEED_USER.password}`);

  // ─── 3. Model Provider + Models ───────────────────
  const [provider] = await db
    .insert(modelProviders)
    .values({
      orgId,
      name: "LiteLLM Proxy",
      type: "custom",
      apiBaseUrl: "http://localhost:4000",
    })
    .onConflictDoNothing()
    .returning();

  const providerId = provider?.id ?? (await db.select().from(modelProviders).where(eq(modelProviders.orgId, orgId)).then((r) => r[0]!.id));

  const modelDefs = [
    { name: "LM Studio (gpt-oss:20b)", modelIdExternal: "lmstudio/gpt-oss:20b", capabilities: ["chat"], contextWindow: 32000, isDefault: true },
    { name: "LM Studio Embeddings", modelIdExternal: "lmstudio/text-embedding-nomic-embed-text-v1.5", capabilities: ["embeddings"], contextWindow: 8192 },
  ];

  for (const m of modelDefs) {
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
      })
      .onConflictDoNothing();
  }
  console.log(`  Models: ${modelDefs.length} registered`);

  // ─── 4. Prompt Templates ──────────────────────────
  const prompts = [
    {
      name: "Code Review",
      description: "Thorough code review with actionable feedback",
      category: "development",
      content: "Review the following code. Focus on:\n- Bugs and edge cases\n- Performance concerns\n- Security vulnerabilities\n- Readability and maintainability\n\nProvide specific, actionable suggestions with code examples where appropriate.\n\n```{{language}}\n{{code}}\n```",
      variables: [{ name: "language", description: "Programming language" }, { name: "code", description: "Code to review" }],
      systemPrompt: "You are a senior software engineer performing a thorough code review. Be direct, specific, and constructive.",
    },
    {
      name: "Explain Like I'm 5",
      description: "Break down complex topics into simple explanations",
      category: "education",
      content: "Explain the following topic in simple terms that anyone could understand. Use analogies and everyday examples.\n\nTopic: {{topic}}",
      variables: [{ name: "topic", description: "The topic to explain" }],
      systemPrompt: "You explain complex topics using simple language, relatable analogies, and short sentences. Avoid jargon.",
    },
    {
      name: "Technical Architecture",
      description: "Design system architecture for a given problem",
      category: "development",
      content: "Design a technical architecture for the following requirement:\n\n{{requirement}}\n\nInclude:\n- High-level component diagram (describe in text)\n- Data flow\n- Technology choices with rationale\n- Scalability considerations\n- Potential failure points and mitigations",
      variables: [{ name: "requirement", description: "System requirement or problem statement" }],
      systemPrompt: "You are a principal architect with deep experience in distributed systems. Be opinionated about technology choices and justify your decisions.",
    },
    {
      name: "Meeting Summary",
      description: "Summarize meeting notes into structured action items",
      category: "productivity",
      content: "Summarize the following meeting notes into:\n1. Key decisions made\n2. Action items (with owners if mentioned)\n3. Open questions\n4. Next steps\n\nMeeting notes:\n{{notes}}",
      variables: [{ name: "notes", description: "Raw meeting notes or transcript" }],
      systemPrompt: "You distill unstructured meeting notes into clear, concise summaries. Focus on what was decided and what needs to happen next.",
    },
    {
      name: "SQL Query Builder",
      description: "Generate SQL queries from natural language descriptions",
      category: "development",
      content: "Write a SQL query for the following request:\n\n{{request}}\n\nDatabase schema:\n{{schema}}\n\nUse PostgreSQL syntax. Include comments explaining the query logic.",
      variables: [{ name: "request", description: "What the query should do" }, { name: "schema", description: "Relevant table definitions" }],
      systemPrompt: "You are a database expert. Write clean, performant SQL. Prefer CTEs over subqueries. Always consider index usage.",
    },
  ];

  for (const p of prompts) {
    await db
      .insert(promptTemplates)
      .values({
        orgId,
        ownerId: userId,
        name: p.name,
        description: p.description,
        content: p.content,
        variables: p.variables,
        systemPrompt: p.systemPrompt,
        category: p.category,
        visibility: "org",
        isApproved: true,
      })
      .onConflictDoNothing();
  }
  console.log(`  Prompt templates: ${prompts.length} created`);

  // ─── 5. Agents ────────────────────────────────────
  const agentDefs = [
    {
      name: "Research Assistant",
      description: "Searches the web and synthesizes information from multiple sources to answer questions with citations.",
      systemPrompt: `You are a research assistant with access to web search and URL fetching tools. When answering questions:

1. Search for relevant, recent information using web_search
2. Fetch and read specific pages when needed using fetch_url
3. Synthesize information from multiple sources
4. Always cite your sources with URLs
5. Distinguish between facts and your interpretation
6. If information is conflicting, present both sides

Be thorough but concise. Prioritize accuracy over speed.`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 10,
      timeoutSeconds: 120,
    },
    {
      name: "Code Assistant",
      description: "Helps write, debug, and explain code across multiple programming languages.",
      systemPrompt: `You are an expert software engineer. You help with:

- Writing clean, idiomatic code in any language
- Debugging issues with clear explanations
- Code reviews with constructive feedback
- Explaining complex code or algorithms
- Suggesting architectural improvements

Guidelines:
- Write production-quality code, not prototypes
- Include error handling and edge cases
- Prefer simplicity over cleverness
- Add brief comments only where logic isn't self-evident
- When debugging, explain the root cause, not just the fix`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 5,
      timeoutSeconds: 60,
    },
    {
      name: "Writing Editor",
      description: "Improves writing clarity, grammar, tone, and structure. Supports multiple styles from casual to academic.",
      systemPrompt: `You are a skilled editor who improves written content while preserving the author's voice. You can:

- Fix grammar, spelling, and punctuation
- Improve clarity and conciseness
- Adjust tone (formal, casual, academic, technical)
- Restructure for better flow
- Suggest stronger word choices

When editing:
- Show your changes clearly (before/after or tracked changes)
- Explain significant changes briefly
- Ask clarifying questions about intent if the meaning is ambiguous
- Don't over-edit — preserve the author's style where it works`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 3,
      timeoutSeconds: 60,
    },
    {
      name: "Data Analyst",
      description: "Analyzes data, generates SQL queries, interprets results, and creates summaries with insights.",
      systemPrompt: `You are a data analyst who helps users understand and work with data. You can:

- Write SQL queries (PostgreSQL) from natural language
- Interpret query results and find patterns
- Create summary statistics and insights
- Suggest visualizations for the data
- Identify data quality issues

Guidelines:
- Always explain your SQL logic step by step
- Use CTEs for readability over nested subqueries
- Consider performance — mention if a query might be slow
- When interpreting data, separate observations from conclusions
- Suggest follow-up analyses when relevant`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 8,
      timeoutSeconds: 120,
    },
  ];

  for (const a of agentDefs) {
    await db
      .insert(agents)
      .values({
        orgId,
        ownerId: userId,
        name: a.name,
        description: a.description,
        systemPrompt: a.systemPrompt,
        visibility: a.visibility,
        toolApprovalMode: a.toolApprovalMode,
        maxSteps: a.maxSteps,
        timeoutSeconds: a.timeoutSeconds,
        isEnabled: true,
        isPublished: true,
      })
      .onConflictDoNothing();
  }
  console.log(`  Agents: ${agentDefs.length} created`);

  // ─── Done ─────────────────────────────────────────
  console.log("\n  Seed complete!");
  console.log(`\n  Login at http://localhost:5173`);
  console.log(`    Email:    ${SEED_USER.email}`);
  console.log(`    Password: ${SEED_USER.password}\n`);

  await authClient.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
