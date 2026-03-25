/**
 * Widget config validation.
 *
 * Validates the shape of widget JSON configs before rendering.
 * Catches structural issues early so widgets get meaningful error messages
 * instead of silent failures or crashes.
 */

import { WIDGET_REGISTRY } from "./registry";

/** All registered widget type keys (derived from the registry at import time). */
const KNOWN_TYPES = new Set(Object.keys(WIDGET_REGISTRY));

// Also accept "iframe" which is handled directly by DynamicWidget, not via registry
KNOWN_TYPES.add("iframe");

type ParseSuccess = { ok: true; config: WidgetConfig };
type ParseFailure = { ok: false; error: string; raw: unknown };
type ParseResult = ParseSuccess | ParseFailure;

interface WidgetConfig {
  type: string;
  title?: string;
  src?: string;
  endpoint?: string;
  refreshInterval?: number;
  height?: number;
  params?: Record<string, unknown>;
}

/**
 * Validate a raw parsed object as a widget config.
 * Returns the config if valid, or a descriptive error string.
 *
 * This is intentionally lenient on params — individual widgets handle
 * their own param parsing with fallbacks. We only validate the structural
 * envelope here.
 */
export function parseWidgetConfig(raw: unknown): ParseResult {
  if (raw == null || typeof raw !== "object") {
    return { ok: false, error: "Widget config must be a JSON object", raw };
  }

  const obj = raw as Record<string, unknown>;

  // type is required and must be a string
  if (typeof obj.type !== "string" || !obj.type) {
    return { ok: false, error: "Missing or invalid \"type\" field", raw };
  }

  // Check against known widget types
  if (!KNOWN_TYPES.has(obj.type)) {
    return {
      ok: false,
      error: `Unknown widget type "${obj.type}". Available: ${[...KNOWN_TYPES].sort().join(", ")}`,
      raw,
    };
  }

  // Validate optional numeric fields
  if (obj.refreshInterval != null && typeof obj.refreshInterval !== "number") {
    return { ok: false, error: "\"refreshInterval\" must be a number (seconds)", raw };
  }
  if (obj.height != null && typeof obj.height !== "number") {
    return { ok: false, error: "\"height\" must be a number (pixels)", raw };
  }

  // Validate params if present — must be an object (not array, not primitive)
  if (obj.params != null) {
    if (typeof obj.params !== "object" || Array.isArray(obj.params)) {
      return { ok: false, error: "\"params\" must be a JSON object", raw };
    }
  }

  // iframe requires src (can be top-level or inside params)
  if (obj.type === "iframe") {
    const params = obj.params as Record<string, unknown> | undefined;
    const hasSrc = typeof obj.src === "string" || typeof params?.src === "string";
    if (!hasSrc) {
      return { ok: false, error: "iframe widget requires a \"src\" URL", raw };
    }
  }

  return { ok: true, config: obj as WidgetConfig };
}
