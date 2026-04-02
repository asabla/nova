/**
 * Lightweight frontend telemetry — error reporting + Web Vitals.
 * Gated behind VITE_TELEMETRY_ENABLED=true. ~2KB budget.
 * Batches reports and POSTs to /api/telemetry/frontend.
 */

const ENABLED = import.meta.env.VITE_TELEMETRY_ENABLED === "true";
const ENDPOINT = "/api/telemetry/frontend";
const FLUSH_INTERVAL = 10_000; // 10 seconds
const MAX_BUFFER = 50;

interface TelemetryEvent {
  type: "error" | "vital" | "navigation";
  timestamp: string;
  data: Record<string, unknown>;
}

const buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function enqueue(event: TelemetryEvent) {
  if (!ENABLED) return;
  buffer.push(event);
  if (buffer.length >= MAX_BUFFER) flush();
}

async function flush() {
  if (buffer.length === 0) return;
  const events = buffer.splice(0, MAX_BUFFER);
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {
    // Silently drop — telemetry should never break the app
  }
}

/** Report a JS error to the telemetry backend. */
export function reportError(error: Error, componentStack?: string) {
  enqueue({
    type: "error",
    timestamp: new Date().toISOString(),
    data: {
      message: error.message,
      stack: error.stack?.slice(0, 1000),
      componentStack: componentStack?.slice(0, 500),
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
  });
}

/** Report a Web Vital metric. */
export function reportVital(name: string, value: number, rating: string) {
  enqueue({
    type: "vital",
    timestamp: new Date().toISOString(),
    data: { name, value, rating },
  });
}

/** Initialize frontend telemetry — call once in main.tsx. */
export function initFrontendTelemetry() {
  if (!ENABLED) return;

  // Global error handler
  window.addEventListener("error", (event) => {
    if (event.error) reportError(event.error);
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportError(error);
  });

  // Web Vitals (lazy import to keep initial bundle small)
  import("web-vitals").then(({ onCLS, onFID, onLCP, onFCP, onTTFB }) => {
    onCLS((m) => reportVital("CLS", m.value, m.rating));
    onFID((m) => reportVital("FID", m.value, m.rating));
    onLCP((m) => reportVital("LCP", m.value, m.rating));
    onFCP((m) => reportVital("FCP", m.value, m.rating));
    onTTFB((m) => reportVital("TTFB", m.value, m.rating));
  }).catch(() => { /* web-vitals not installed — skip */ });

  // Periodic flush
  flushTimer = setInterval(flush, FLUSH_INTERVAL);

  // Flush on page unload
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
