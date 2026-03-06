import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { domainRules } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

export const domainService = {
  async listRules(orgId: string) {
    return db
      .select()
      .from(domainRules)
      .where(and(eq(domainRules.orgId, orgId), isNull(domainRules.deletedAt)))
      .orderBy(desc(domainRules.createdAt));
  },

  async addRule(orgId: string, userId: string, data: {
    domain: string;
    type: "allow" | "block";
    reason?: string;
  }) {
    // Normalize domain to lowercase, strip protocol/path
    const normalized = data.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    if (!normalized) {
      throw AppError.badRequest("Invalid domain");
    }

    const [rule] = await db
      .insert(domainRules)
      .values({
        orgId,
        domain: normalized,
        type: data.type,
        reason: data.reason,
        createdById: userId,
      })
      .returning();

    return rule;
  },

  async removeRule(orgId: string, ruleId: string) {
    const [rule] = await db
      .update(domainRules)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(domainRules.id, ruleId), eq(domainRules.orgId, orgId), isNull(domainRules.deletedAt)))
      .returning();

    if (!rule) throw AppError.notFound("Domain rule not found");
    return rule;
  },

  async checkUrl(orgId: string, url: string): Promise<{ allowed: boolean; matchedRule?: { id: string; domain: string; type: string; reason: string | null } }> {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw AppError.badRequest("Invalid URL");
    }

    // Fetch all active rules for this org
    const rules = await db
      .select()
      .from(domainRules)
      .where(and(eq(domainRules.orgId, orgId), isNull(domainRules.deletedAt)));

    // Check for matching rules - most specific match wins (longer domain string)
    // e.g., "api.example.com" is more specific than "example.com"
    const matchingRules = rules.filter((r) => {
      return hostname === r.domain || hostname.endsWith(`.${r.domain}`);
    }).sort((a, b) => b.domain.length - a.domain.length);

    if (matchingRules.length === 0) {
      // No rules match - if there are any "allow" rules at all, implicit deny;
      // if only "block" rules exist, default allow
      const hasAllowRules = rules.some((r) => r.type === "allow");
      return { allowed: !hasAllowRules };
    }

    const bestMatch = matchingRules[0];
    return {
      allowed: bestMatch.type === "allow",
      matchedRule: {
        id: bestMatch.id,
        domain: bestMatch.domain,
        type: bestMatch.type,
        reason: bestMatch.reason,
      },
    };
  },
};
