import { describe, it, expect } from "bun:test";

// Set required env vars before importing the app
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.S3_ENDPOINT = "http://localhost:9000";
process.env.S3_ACCESS_KEY = "minioadmin";
process.env.S3_SECRET_KEY = "minioadmin";
process.env.LITELLM_API_URL = "http://localhost:4000";
process.env.LITELLM_MASTER_KEY = "sk-test";
process.env.BETTER_AUTH_SECRET = "test-secret-that-is-at-least-32-chars-long";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

const { app } = await import("../src/app");

describe("Health endpoints", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
