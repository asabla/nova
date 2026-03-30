/**
 * Standardised Temporal retry policies.
 *
 * Categories:
 *  - EXTERNAL: for calls to external APIs (LLM providers, GitHub, SearxNG, etc.)
 *  - DATABASE: for idempotent DB writes and reads
 *  - PUBLISH:  for Redis pub/sub and lightweight status updates
 *  - LONG_RUNNING: for activities that may run >5 min (agent loops, syncs)
 */
export const RETRY_POLICIES = {
  /** External API calls — prone to transient network/rate-limit failures */
  EXTERNAL: {
    maximumAttempts: 5,
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumInterval: "2 minutes",
  },

  /** Idempotent database operations */
  DATABASE: {
    maximumAttempts: 3,
    initialInterval: "500 milliseconds",
    backoffCoefficient: 1.5,
    maximumInterval: "30 seconds",
  },

  /** Publishing / lightweight status notifications */
  PUBLISH: {
    maximumAttempts: 3,
    initialInterval: "200 milliseconds",
    backoffCoefficient: 2,
    maximumInterval: "5 seconds",
  },

  /** Long-running activities (agent loops, connector syncs) */
  LONG_RUNNING: {
    maximumAttempts: 3,
    initialInterval: "2 seconds",
    backoffCoefficient: 2,
    maximumInterval: "5 minutes",
  },
} as const;
