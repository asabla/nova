/**
 * Shared param parsing utilities for widgets.
 *
 * Widgets receive params as Record<string, string> after normalizeParams.
 * These helpers handle both JSON array strings and legacy CSV strings,
 * so widgets work regardless of how the data was serialized.
 */

/**
 * Parse a string param as an array of strings.
 * Accepts JSON arrays (`'["a","b"]'`) or CSV (`"a,b"`).
 */
export function parseStringArray(raw: string | undefined, fallback: string[] = []): string[] {
  if (!raw) return fallback;
  // Try JSON first
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Fall through to CSV
    }
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a string param as an array of numbers.
 * Accepts JSON arrays (`'[1,2,3]'`) or CSV (`"1,2,3"`).
 */
export function parseNumberArray(raw: string | undefined, fallback: number[] = []): number[] {
  if (!raw) return fallback;
  // Try JSON first
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => !isNaN(n));
    } catch {
      // Fall through to CSV
    }
  }
  return raw.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
}

/**
 * Parse a string param as a JSON object/array of type T.
 * Falls back to provided default if parsing fails or input is empty.
 */
export function parseJSON<T>(raw: string | undefined | T, fallback: T): { data: T; error?: string } {
  if (!raw) return { data: fallback };
  if (typeof raw !== "string") return { data: raw as T };
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { data: fallback, error: `Invalid JSON: ${String(raw).slice(0, 80)}…` };
  }
}
