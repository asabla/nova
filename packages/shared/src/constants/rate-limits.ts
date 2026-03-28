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
} as const;
