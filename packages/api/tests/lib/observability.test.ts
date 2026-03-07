import { describe, it, expect } from "bun:test";
import { getHeliconeHeaders } from "../../src/lib/observability";

describe("observability", () => {
  describe("getHeliconeHeaders", () => {
    it("returns empty when HELICONE_API_KEY is not set", () => {
      delete process.env.HELICONE_API_KEY;
      const headers = getHeliconeHeaders({ userId: "u1", orgId: "o1" });
      expect(Object.keys(headers)).toHaveLength(0);
    });

    it("returns headers when HELICONE_API_KEY is set", () => {
      process.env.HELICONE_API_KEY = "test-key";
      const headers = getHeliconeHeaders({
        userId: "u1",
        orgId: "o1",
        conversationId: "c1",
        agentId: "a1",
      });
      expect(headers["Helicone-Auth"]).toBe("Bearer test-key");
      expect(headers["Helicone-User-Id"]).toBe("u1");
      expect(headers["Helicone-Property-OrgId"]).toBe("o1");
      expect(headers["Helicone-Property-ConversationId"]).toBe("c1");
      expect(headers["Helicone-Property-AgentId"]).toBe("a1");
      delete process.env.HELICONE_API_KEY;
    });

    it("omits undefined metadata fields", () => {
      process.env.HELICONE_API_KEY = "test-key";
      const headers = getHeliconeHeaders({ userId: "u1" });
      expect(headers["Helicone-Auth"]).toBeDefined();
      expect(headers["Helicone-User-Id"]).toBe("u1");
      expect(headers["Helicone-Property-OrgId"]).toBeUndefined();
      delete process.env.HELICONE_API_KEY;
    });
  });
});
