import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "./db.js";
import { systemPrompts, systemPromptVersions } from "@nova/shared/schemas";

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CachedPrompt {
  content: string;
  versionId: string;
}

interface CacheEntry {
  /** Active version (100% traffic when no A/B test) */
  active: CachedPrompt | null;
  /** Testing versions with their traffic percentages */
  testing: Array<CachedPrompt & { trafficPct: number }>;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(orgId: string, slug: string): string {
  return `${orgId}:${slug}`;
}

// ---------------------------------------------------------------------------
// Hardcoded fallbacks — used when no DB entry exists
// ---------------------------------------------------------------------------

const FALLBACK_PROMPTS: Record<string, string> = {};

/**
 * Register a hardcoded fallback prompt for a given slug.
 * Call this at startup to ensure graceful degradation if the DB has no entry.
 */
export function registerFallbackPrompt(slug: string, content: string): void {
  FALLBACK_PROMPTS[slug] = content;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolvedPrompt {
  content: string;
  versionId: string;
  source: "db" | "fallback";
}

/**
 * Resolves a system prompt by org + slug.
 *
 * 1. Queries DB for the system_prompt and its active/testing versions
 * 2. If A/B test is active (testing versions with trafficPct > 0), randomly
 *    selects between active and testing versions by weight
 * 3. Falls back to registered hardcoded defaults if no DB entry exists
 */
export async function resolveSystemPrompt(
  orgId: string,
  slug: string,
): Promise<ResolvedPrompt> {
  const key = cacheKey(orgId, slug);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return pickVersion(cached, slug);
  }

  // Load from DB
  const entry = await loadFromDb(orgId, slug);
  cache.set(key, { ...entry, ts: Date.now() });
  return pickVersion(entry, slug);
}

async function loadFromDb(
  orgId: string,
  slug: string,
): Promise<Omit<CacheEntry, "ts">> {
  // Find the system prompt for this org + slug
  const rows = await db
    .select({ id: systemPrompts.id, activeVersionId: systemPrompts.activeVersionId })
    .from(systemPrompts)
    .where(
      and(
        eq(systemPrompts.orgId, orgId),
        eq(systemPrompts.slug, slug),
        isNull(systemPrompts.deletedAt),
      ),
    )
    .limit(1);

  const sp = rows[0];
  if (!sp) {
    return { active: null, testing: [] };
  }

  // Load active + testing versions
  const versions = await db
    .select({
      id: systemPromptVersions.id,
      content: systemPromptVersions.content,
      status: systemPromptVersions.status,
      trafficPct: systemPromptVersions.trafficPct,
    })
    .from(systemPromptVersions)
    .where(
      and(
        eq(systemPromptVersions.systemPromptId, sp.id),
        inArray(systemPromptVersions.status, ["active", "testing"]),
      ),
    );

  let active: CachedPrompt | null = null;
  const testing: Array<CachedPrompt & { trafficPct: number }> = [];

  for (const v of versions) {
    if (v.status === "active") {
      active = { content: v.content, versionId: v.id };
    } else if (v.status === "testing" && v.trafficPct > 0) {
      testing.push({ content: v.content, versionId: v.id, trafficPct: v.trafficPct });
    }
  }

  return { active, testing };
}

function pickVersion(
  entry: Omit<CacheEntry, "ts">,
  slug: string,
): ResolvedPrompt {
  // If no DB data at all, fall back to hardcoded
  if (!entry.active && entry.testing.length === 0) {
    const fallback = FALLBACK_PROMPTS[slug];
    if (fallback) {
      return { content: fallback, versionId: "fallback", source: "fallback" };
    }
    return { content: "", versionId: "none", source: "fallback" };
  }

  // If no A/B testing active, return the active version
  if (entry.testing.length === 0) {
    return { content: entry.active!.content, versionId: entry.active!.versionId, source: "db" };
  }

  // A/B traffic split: testing versions claim their trafficPct, active gets the remainder
  const totalTestingPct = entry.testing.reduce((sum, t) => sum + t.trafficPct, 0);
  const activePct = Math.max(0, 100 - totalTestingPct);
  const roll = Math.random() * 100;

  let cumulative = 0;

  // Check active version first
  cumulative += activePct;
  if (roll < cumulative && entry.active) {
    return { content: entry.active.content, versionId: entry.active.versionId, source: "db" };
  }

  // Check testing versions
  for (const t of entry.testing) {
    cumulative += t.trafficPct;
    if (roll < cumulative) {
      return { content: t.content, versionId: t.versionId, source: "db" };
    }
  }

  // Shouldn't reach here, but fallback to active
  if (entry.active) {
    return { content: entry.active.content, versionId: entry.active.versionId, source: "db" };
  }
  return { content: entry.testing[0].content, versionId: entry.testing[0].versionId, source: "db" };
}

/**
 * Invalidate cached prompts for an org (or all orgs).
 * Call after deploying/updating prompt versions.
 */
export function invalidatePromptCache(orgId?: string, slug?: string): void {
  if (orgId && slug) {
    cache.delete(cacheKey(orgId, slug));
  } else if (orgId) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${orgId}:`)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
