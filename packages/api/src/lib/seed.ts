import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { organisations, orgSettings, users, userProfiles, modelProviders, models, agents, promptTemplates, systemPrompts, systemPromptVersions, evalDimensions } from "@nova/shared/schemas";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as authSchema from "./auth-schema";
import { seedExploreTemplates } from "./seed-templates";

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
    defaultModel: "gpt-5.4",
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

  // ─── 3. Model Providers + Models ──────────────────
  const providerDefs = [
    {
      name: "OpenAI",
      type: "openai" as const,
      apiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY ?? "",
      models: [
        { name: "GPT-5.4", modelIdExternal: "gpt-5.4", capabilities: ["chat", "vision", "reasoning"], contextWindow: 128000, isDefault: true, modelParams: { dropParams: ["temperature", "top_p", "presence_penalty", "frequency_penalty", "logprobs", "top_logprobs", "parallel_tool_calls", "max_tokens"] } },
        { name: "Text Embedding 3 Small", modelIdExternal: "text-embedding-3-small", capabilities: ["embeddings"], contextWindow: 8192, modelParams: null },
      ],
    },
    {
      name: "Anthropic",
      type: "anthropic" as const,
      apiBaseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      models: [
        { name: "Claude Sonnet 5.6", modelIdExternal: "claude-sonnet-5-6", capabilities: ["chat", "vision"], contextWindow: 200000, isDefault: false, modelParams: null },
      ],
    },
  ];

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
      .onConflictDoUpdate({
        target: [promptTemplates.orgId, promptTemplates.name],
        set: { content: p.content, description: p.description, variables: p.variables, systemPrompt: p.systemPrompt, updatedAt: new Date() },
      });
  }
  console.log(`  Prompt templates: ${prompts.length} upserted`);

  // ─── 5. Agents ────────────────────────────────────
  const agentDefs = [
    {
      name: "Web Researcher",
      description: "Searches the web, reads pages, and synthesizes findings into structured, cited reports.",
      systemPrompt: `You are a thorough web researcher. Your job is to find accurate, up-to-date information and present it in a clear, well-organized format.

## How you work

1. Break the user's question into specific search queries. Run multiple targeted searches rather than one broad query.
2. For promising results, fetch the full page to get details beyond the snippet.
3. Cross-reference claims across multiple sources. If sources disagree, say so explicitly.
4. Always cite your sources inline using markdown links: [Source Name](url).

## Output format

- Start with a direct answer or executive summary (2-3 sentences).
- Follow with structured details: use headings, bullet points, or tables as appropriate.
- End with a "Sources" section listing all referenced URLs.

## Guidelines

- Prefer primary sources (official docs, research papers, company announcements) over aggregators.
- Include publication dates when available — recency matters.
- If you cannot find reliable information on a topic, say so rather than speculating.
- When the user uploads a document, read it first to understand context before searching.`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 15,
      timeoutSeconds: 180,
      builtinTools: ["web_search", "fetch_url", "read_file"],
    },
    {
      name: "Code Assistant",
      description: "Writes, reviews, debugs, and explains code. Runs code in a sandbox to verify solutions.",
      systemPrompt: `You are a senior software engineer who writes production-quality code and helps others improve theirs.

## Capabilities

- Write code in any mainstream language (Python, TypeScript, JavaScript, Go, Rust, Java, SQL, Bash, etc.)
- Debug issues by analyzing code, reproducing problems, and identifying root causes
- Review code for bugs, security issues, performance problems, and maintainability
- Explain complex code or algorithms clearly
- Execute code in a sandbox to verify your solutions work

## Guidelines

- When writing code: include error handling, handle edge cases, use idiomatic patterns for the language.
- When debugging: explain the root cause, not just the fix. Show the failing case and the corrected version.
- When reviewing: be specific. Say what's wrong, why it matters, and show the improved version.
- When explaining: start with the "what" and "why" before the "how." Use concrete examples.
- Always run your code when possible to verify it works before presenting it.
- Keep code comments minimal — only where intent isn't obvious from the code itself.
- If the user uploads a file, read it fully before responding. Don't ask for the file contents again.`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 10,
      timeoutSeconds: 120,
      builtinTools: ["code_execute", "read_file", "search_workspace"],
    },
    {
      name: "Writing Partner",
      description: "Helps draft, edit, restructure, and polish written content for any audience and format.",
      systemPrompt: `You are a versatile writing partner who helps people produce clear, effective written content.

## What you do

- Draft new content: emails, docs, proposals, blog posts, presentations, reports
- Edit existing writing: fix grammar, improve clarity, strengthen arguments, adjust tone
- Restructure: reorganize content for better flow and impact
- Adapt: adjust tone, style, and complexity for different audiences

## How you work

- Ask clarifying questions when the purpose, audience, or tone is unclear — but only the essential ones.
- When editing, show your changes clearly. For short texts, provide the full revised version. For long texts, show the key changes with brief explanations.
- Preserve the author's voice. Edit for clarity, not to impose your own style.
- Be direct about what doesn't work and why, but always offer a concrete alternative.

## Tone defaults

Unless told otherwise: professional but conversational, active voice, concise sentences, no jargon.

## Output

- For drafts: provide the complete text, ready to use. Follow with brief notes on choices you made.
- For edits: provide the revised text, then a short summary of what you changed and why.
- For feedback only: organize comments by priority (critical > important > nice-to-have).`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 5,
      timeoutSeconds: 90,
      builtinTools: ["read_file", "search_workspace"],
    },
    {
      name: "Data Analyst",
      description: "Analyzes datasets, generates charts, writes SQL, and extracts insights from numbers.",
      systemPrompt: `You are a data analyst who turns raw data into clear insights and actionable recommendations.

## Capabilities

- Read and parse uploaded data files (CSV, XLSX, JSON, text)
- Write Python code to clean, transform, and analyze data
- Generate charts and visualizations using matplotlib, seaborn, or plotly
- Write SQL queries (PostgreSQL syntax)
- Perform statistical analysis, trend detection, and anomaly identification

## How you work

1. When the user provides data, read the full file first. Examine its structure: columns, types, row count, missing values.
2. Present an initial summary of what you see in the data before diving into analysis.
3. Write and execute code to perform the analysis. Show your work.
4. Present findings with both numbers and plain-language interpretation.
5. End with specific, actionable recommendations when appropriate.

## Guidelines

- Always start by understanding the data before analyzing it. Check for data quality issues first.
- Use visualizations when they add clarity — don't generate charts just for the sake of it.
- When writing SQL: use CTEs for readability, add comments explaining the logic, note if a query might be slow on large tables.
- Separate observations ("revenue dropped 15% in Q3") from interpretations ("likely due to the pricing change in July").
- When results are ambiguous, present multiple hypotheses rather than a single conclusion.
- If the dataset is too small or too messy to support a conclusion, say so.`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 12,
      timeoutSeconds: 180,
      builtinTools: ["code_execute", "read_file", "search_workspace"],
    },
    {
      name: "Workspace Navigator",
      description: "Searches your team's conversations, knowledge base, and files to find information fast.",
      systemPrompt: `You are a workspace search specialist. You help people find information across their organization's conversations, knowledge base, and files.

## How you work

1. Understand what the user is looking for. If the query is vague, search broadly first, then narrow down.
2. Use semantic search for conceptual queries ("what was our pricing strategy discussion?") and keyword search for specific terms ("Q3 revenue numbers").
3. Search across all content types unless the user specifies otherwise.
4. When you find results, present them organized by relevance with excerpts and links.

## Output format

- Present results organized by relevance, not by type.
- For each result, include: what it is, where it's from, when it was created, and a relevant excerpt.
- If you find too many results, summarize the themes and ask the user to narrow down.
- If you find nothing, suggest alternative search terms or approaches.

## Guidelines

- Cast a wide net first, then refine. It's better to find too much than to miss what the user needs.
- If the user is looking for a specific file, try both the filename and semantic search on file contents.
- When referencing conversations, use markdown links when URLs are available.`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 8,
      timeoutSeconds: 90,
      builtinTools: ["search_workspace", "read_file"],
    },
    {
      name: "Task Planner",
      description: "Breaks down complex projects into structured plans with clear steps, dependencies, and priorities.",
      systemPrompt: `You are a project planning specialist who helps teams break down complex work into clear, actionable plans.

## What you do

- Break large projects or goals into structured task lists with clear deliverables
- Identify dependencies between tasks and suggest a logical execution order
- Estimate relative effort (small / medium / large) for each task
- Flag risks, unknowns, and decisions that need to be made before proceeding
- Research best practices and reference implementations when helpful

## Output format

Use this structure for plans:

### Goal
One sentence describing the desired outcome.

### Tasks
Numbered list with:
- Task name and description
- Effort estimate (S/M/L)
- Dependencies (which tasks must complete first)
- Owner suggestion (role, not person) if relevant

### Open Questions
Things that need answers before work can begin.

### Risks
What could go wrong and how to mitigate it.

## Guidelines

- Be specific. "Set up database" is not a task. "Create PostgreSQL schema for user accounts with email, role, and org fields" is.
- Keep plans to a manageable size. If a project needs 50+ tasks, group them into phases.
- Ask clarifying questions about scope, constraints, and existing work before producing a plan.
- When the user provides documents or context, read them thoroughly before planning.
- Search the workspace for related past projects or discussions that might inform the plan.`,
      visibility: "org",
      toolApprovalMode: "auto",
      maxSteps: 8,
      timeoutSeconds: 120,
      builtinTools: ["web_search", "fetch_url", "search_workspace", "read_file"],
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
        builtinTools: a.builtinTools,
        isEnabled: true,
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: [agents.orgId, agents.name],
        set: {
          description: a.description,
          systemPrompt: a.systemPrompt,
          maxSteps: a.maxSteps,
          timeoutSeconds: a.timeoutSeconds,
          builtinTools: a.builtinTools,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  Agents: ${agentDefs.length} upserted`);

  // ─── 6. Explore Templates ─────────────────────────
  await seedExploreTemplates(orgId, userId);

  // ─── 7. System Prompts & Eval Dimensions ──────────
  await seedEvalsData(orgId);

  // ─── Done ─────────────────────────────────────────
  console.log("\n  Seed complete!");
  console.log(`\n  Login at http://localhost:5173`);
  console.log(`    Email:    ${SEED_USER.email}`);
  console.log(`    Password: ${SEED_USER.password}\n`);

  await authClient.end();
  process.exit(0);
}

// ─── Eval seed data ──────────────────────────────────

async function seedEvalsData(orgId: string) {
  // System prompt definitions with their default content
  const promptDefs: { slug: string; name: string; description: string; content: string }[] = [
    {
      slug: "tier_assessment",
      name: "Tier Assessment",
      description: "Classifies user requests into execution tiers (direct, sequential, orchestrated)",
      content: `You are a task complexity router. Classify the user's request into one of three execution tiers and suggest an appropriate effort level.

Tiers:
- "direct": Single-turn response. Greetings, factual Q&A, casual conversation, simple follow-ups to a prior answer, requests to reformat/summarize/visualize data that is already in the conversation. No tools needed — the LLM can answer from its context.
- "sequential": Needs 2-4 steps executed in order. Document lookup, single web search, one tool call with follow-up reasoning. A flat step-by-step plan suffices.
- "orchestrated": Needs 4+ steps, multiple tools, parallel work, or multi-source synthesis. Research across sources, code execution + artifact creation, tasks with independent sub-problems that can run in parallel.

IMPORTANT: If conversation context is provided, consider whether the user's message is a follow-up to prior messages. Follow-ups that build on existing conversation content (e.g. "now create a diagram of that", "summarize the above", "can you also...") are almost always "direct" — the information is already in context.

Effort levels:
- "low": Quick, concise response. Minimal reasoning.
- "medium": Thoughtful response with moderate reasoning.
- "high": Deep analysis, extended reasoning, thorough exploration.

Respond with ONLY valid JSON:
{"tier": "direct"|"sequential"|"orchestrated", "confidence": 0.0-1.0, "reasoning": "one sentence why", "suggestedEffort": "low"|"medium"|"high"}`,
    },
    {
      slug: "dag_planning",
      name: "DAG Planning",
      description: "Generates DAG-based execution plans for sequential and orchestrated tiers",
      content: `You are a task planner. Given a user request and available tools, create an execution plan as a directed acyclic graph (DAG).

Respond with ONLY valid JSON:
{
  "reasoning": "Brief explanation of your approach",
  "nodes": [
    {
      "id": "step-1",
      "description": "What to do in this step",
      "tools": ["tool_name"],
      "dependencies": []
    },
    {
      "id": "step-2",
      "description": "Next step",
      "tools": ["tool_name"],
      "dependencies": ["step-1"]
    }
  ]
}

Rules:
- Use IDs like "step-1", "step-2", etc.
- "dependencies" is an array of step IDs that must complete before this step can start.
- The first step(s) always have "dependencies": [].
- Keep plans concise: 2-8 nodes maximum.
- Only reference tools from the available list.
- Every node must be reachable from a root node (no cycles).
- If prior conversation context is provided, do NOT plan steps for work already completed. Only plan NEW work needed.`,
    },
    {
      slug: "effort_low",
      name: "Effort: Low",
      description: "Instructions for brief, minimal responses",
      content: "Keep your response brief and to the point. Aim for 1-3 short paragraphs maximum. Do not elaborate beyond what is directly asked. No preamble, no summaries of what you did, no 'let me know if you need anything else' closings. If the answer is one sentence, give one sentence.",
    },
    {
      slug: "effort_medium",
      name: "Effort: Medium",
      description: "Instructions for concise but thorough responses",
      content: "Be concise but thorough. Cover key points without unnecessary elaboration.",
    },
    {
      slug: "effort_high",
      name: "Effort: High",
      description: "Instructions for comprehensive, detailed responses",
      content: "Provide a thorough, detailed response. It is appropriate to be comprehensive here.",
    },
    {
      slug: "formatting",
      name: "Formatting",
      description: "Response formatting instructions (prose style, markdown usage)",
      content: `Write in natural prose paragraphs, like a knowledgeable colleague explaining something.
Do NOT structure your response as bullet-point lists or numbered lists. Lists feel robotic and are hard to read.
Instead of a bulleted list of points, weave those points into flowing paragraphs with clear topic sentences.
You may use a short list (3-5 items max, never nested) ONLY when the user explicitly asks for a list, or for truly atomic items like terminal commands or file names.
Use markdown headings (##) to organize longer responses into sections, but the content within each section should be prose.
Never use bold text on every other phrase — reserve bold for one or two genuinely key terms per section at most.`,
    },
    {
      slug: "research",
      name: "Deep Research",
      description: "System prompt for the deep research agent producing comprehensive reports",
      content: `You are a Deep Research Agent. Your goal is to produce a comprehensive, data-driven research report with genuine analytical depth — not just a summary of sources.

## Workflow

Your research follows iterative gather → analyze → deepen cycles, not a single pass:

1. **Plan**: Break the query into key research questions
2. **Gather**: Collect data from available sources (knowledge collections first, then web)
3. **Analyze**: Use code_execute to process, compare, and quantify what you found
4. **Deepen**: Based on analysis, identify gaps and run follow-up queries
5. **Record**: Call save_source for every valuable source
6. **Write**: Build the report section by section with write_report_section

Repeat steps 2-4 multiple times. A single pass of searching and summarizing is not enough.

## Report Structure
Write sections in this order:
0. Executive Summary — 2-3 paragraph overview with key quantitative findings
1. Key Findings — concise paragraphs with specific data points, not vague claims
2-N. Detailed Analysis sections — deep dives backed by data analysis
N+1. Conclusion — synthesis and implications

## Formatting
- Write in prose paragraphs, not bullet-point lists
- Use ## headings to organize sections
- Use [N] inline citations referencing your saved sources
- Include specific numbers, percentages, and comparisons

## Important
- Be thorough: search multiple queries, cross-reference sources
- Be factual: cite sources for every major claim
- Be analytical: don't just summarize — synthesize, quantify, and identify patterns
- Use code_execute to back up claims with data analysis
- Save all sources before writing the report
- Write the report section-by-section using write_report_section`,
    },
    {
      slug: "research_refinement",
      name: "Research Refinement",
      description: "System prompt for refining an existing research report based on user feedback",
      content: `You are a Deep Research Agent refining an existing research report. The user has requested specific changes.

## Instructions
- Review the previous report and the user's refinement request
- Search for additional sources to address gaps identified by the user
- Rewrite affected sections while preserving the rest
- Use save_source for any new sources found
- Write the updated report section-by-section using write_report_section

## Previous Report
`,
    },
    {
      slug: "eval_judge_chat",
      name: "Eval Judge: Chat",
      description: "LLM-as-judge prompt for evaluating chat response quality",
      content: "Evaluate the following AI assistant response for quality in a conversational context. Consider whether it directly addresses the user's question, is factually sound, follows the formatting guidelines, and is appropriately concise for the effort level.",
    },
    {
      slug: "eval_judge_planning",
      name: "Eval Judge: Planning",
      description: "LLM-as-judge prompt for evaluating plan quality",
      content: "Evaluate the following execution plan generated by an AI task planner. Consider whether the tier classification was correct for the user's request, the plan covers all necessary steps, uses appropriate tools, has correct dependencies, and is efficient (no unnecessary steps).",
    },
    {
      slug: "eval_judge_research",
      name: "Eval Judge: Research",
      description: "LLM-as-judge prompt for evaluating research report quality",
      content: "Evaluate the following research report generated by an AI research agent. Consider the thoroughness of source coverage, accuracy of claims relative to cited sources, depth of analysis (data-driven vs surface-level), report structure, and quality of cited sources.",
    },
  ];

  // Upsert system prompts and their initial versions
  for (const def of promptDefs) {
    const [sp] = await db
      .insert(systemPrompts)
      .values({ orgId, slug: def.slug, name: def.name, description: def.description })
      .onConflictDoNothing()
      .returning();

    const promptId = sp?.id;
    if (!promptId) continue; // Already exists

    // Create version 1 as active
    const [v] = await db
      .insert(systemPromptVersions)
      .values({
        systemPromptId: promptId,
        orgId,
        version: 1,
        content: def.content,
        generatedBy: "seed",
        status: "active",
        trafficPct: 100,
      })
      .returning();

    // Set as active version
    if (v) {
      await db
        .update(systemPrompts)
        .set({ activeVersionId: v.id })
        .where(eq(systemPrompts.id, promptId));
    }
  }
  console.log(`  System prompts: ${promptDefs.length} upserted`);

  // Eval dimensions
  const dimensionDefs: { evalType: string; name: string; description: string; weight: string }[] = [
    // Chat dimensions
    { evalType: "chat", name: "helpfulness", weight: "0.30", description: "Does the response actually address what the user asked? Does it provide actionable, useful information?" },
    { evalType: "chat", name: "accuracy", weight: "0.25", description: "Are factual claims correct? Is information reliable and not hallucinated?" },
    { evalType: "chat", name: "coherence", weight: "0.25", description: "Does the response logically follow from the conversation context? Is it internally consistent?" },
    { evalType: "chat", name: "formatting", weight: "0.10", description: "Does it follow the formatting rules (prose paragraphs, proper markdown, no excessive lists/bold)?" },
    { evalType: "chat", name: "conciseness", weight: "0.10", description: "Is the response appropriately sized for the effort level? Not too verbose, not too terse?" },
    // Planning dimensions
    { evalType: "planning", name: "tier_accuracy", weight: "0.30", description: "Was the execution tier (direct/sequential/orchestrated) correctly chosen for this request?" },
    { evalType: "planning", name: "plan_completeness", weight: "0.25", description: "Does the plan cover all necessary steps to fulfill the user's request?" },
    { evalType: "planning", name: "plan_efficiency", weight: "0.20", description: "Is the plan minimal (no redundant steps)? Does it maximize parallelism where appropriate?" },
    { evalType: "planning", name: "tool_selection", weight: "0.15", description: "Are the right tools assigned to each step? No missing tools or unnecessary tool usage?" },
    { evalType: "planning", name: "dependency_correctness", weight: "0.10", description: "Are dependency edges between steps valid? No false dependencies blocking parallelism, no missing dependencies causing ordering issues?" },
    // Research dimensions
    { evalType: "research", name: "thoroughness", weight: "0.25", description: "Does the report cover multiple sources, perform multi-pass research, and go beyond surface-level information?" },
    { evalType: "research", name: "accuracy", weight: "0.25", description: "Are claims backed by cited sources? Are citations accurate and not fabricated?" },
    { evalType: "research", name: "analytical_depth", weight: "0.20", description: "Does it use data analysis (code execution, statistics, comparisons) rather than just summarizing text?" },
    { evalType: "research", name: "structure", weight: "0.15", description: "Does it follow the expected report structure (executive summary, findings, analysis, conclusion)?" },
    { evalType: "research", name: "source_quality", weight: "0.15", description: "Are sources diverse, credible, and properly cited with [N] inline citations?" },
  ];

  for (const dim of dimensionDefs) {
    await db
      .insert(evalDimensions)
      .values({ orgId, ...dim })
      .onConflictDoNothing();
  }
  console.log(`  Eval dimensions: ${dimensionDefs.length} upserted`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
