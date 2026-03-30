export const RATE_LIMITS = {
  PER_IP: {
    maxRequests: 300,
    windowSeconds: 60,
  },
  PER_USER: {
    maxRequests: 300,
    windowSeconds: 60,
  },
  PER_ORG: {
    maxRequests: 5000,
    windowSeconds: 60,
  },
  LLM_CALLS: {
    maxRequests: 30,
    windowSeconds: 60,
  },
  FILE_UPLOADS: {
    maxRequests: 20,
    windowSeconds: 60,
  },
  /** Stricter limit for auth endpoints (login, register, password reset, MFA) */
  AUTH: {
    maxRequests: 10,
    windowSeconds: 60,
  },
  /** Stricter limit for webhook endpoints */
  WEBHOOKS: {
    maxRequests: 60,
    windowSeconds: 60,
  },
} as const;
