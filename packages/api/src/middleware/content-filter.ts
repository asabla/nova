import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { dlpRules } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

// Prompt injection detection patterns (story #174)
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an|in)\s+(new|different|unrestricted)/i,
  /system\s*prompt\s*[:=]/i,
  /\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>|<\|assistant\|>/i,
  /\bDAN\s+mode\b/i,
  /\bjailbreak\b/i,
  /override\s+(your|the|all)\s+(safety|content|guidelines?|restrictions?)/i,
];

// PII detection patterns
const PII_PATTERNS: Record<string, RegExp> = {
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
};

export function contentFilter() {
  return createMiddleware<AppContext>(async (c, next) => {
    // Only apply to POST/PATCH with JSON body on message routes
    if (
      !["POST", "PATCH"].includes(c.req.method) ||
      !c.req.url.includes("/messages")
    ) {
      return next();
    }

    try {
      const body = await c.req.json();
      if (!body?.content || typeof body.content !== "string") {
        return next();
      }

      const orgId = c.get("orgId");

      // Check for prompt injection attempts
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(body.content)) {
          // Log but don't block - strip the suspicious content
          c.set("promptInjectionDetected" as any, true);
          break;
        }
      }

      // Check DLP rules
      const rules = await db.select().from(dlpRules)
        .where(eq(dlpRules.orgId, orgId));

      for (const rule of rules) {
        if (!rule.isEnabled) continue;

        if (rule.detectorType === "pii" && rule.action === "block") {
          for (const [piiType, pattern] of Object.entries(PII_PATTERNS)) {
            if (pattern.test(body.content)) {
              throw AppError.badRequest(`Message blocked: contains ${piiType.replace(/([A-Z])/g, " $1").toLowerCase()} information`);
            }
          }
        }

        if (rule.detectorType === "regex" && rule.pattern) {
          const regex = new RegExp(rule.pattern, "gi");
          if (regex.test(body.content)) {
            if (rule.action === "block") {
              throw AppError.badRequest(`Message blocked by content policy`);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // If parsing fails, continue - content filter is best-effort
    }

    return next();
  });
}
