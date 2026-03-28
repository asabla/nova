import type { NovaClient } from "./client";

export class NovaDB {
  constructor(private client: NovaClient) {}

  async getConversation(id: string) {
    return this.client.get(`/db/conversations/${id}`);
  }

  async getMessages(conversationId: string, opts?: { limit?: number; offset?: number }) {
    const params: Record<string, string> = { conversationId };
    if (opts?.limit) params.limit = String(opts.limit);
    if (opts?.offset) params.offset = String(opts.offset);
    return this.client.get("/db/messages", params);
  }

  async createMessage(data: {
    conversationId: string;
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.client.post("/db/messages", data);
  }

  async updateMessage(id: string, data: { content?: string; metadata?: Record<string, unknown> }) {
    return this.client.patch(`/db/messages/${id}`, data);
  }

  async getAgent(id: string) {
    return this.client.get(`/db/agents/${id}`);
  }

  async getAgentMemory(agentId: string, scope?: string) {
    const params: Record<string, string> = { agentId };
    if (scope) params.scope = scope;
    return this.client.get("/db/agent-memory", params);
  }

  async createAgentMemory(data: {
    agentId: string;
    userId?: string;
    conversationId?: string;
    scope: string;
    key: string;
    value: unknown;
  }) {
    return this.client.post("/db/agent-memory", data);
  }

  async updateWorkflow(id: string, data: { status: string; result?: Record<string, unknown>; error?: string }) {
    return this.client.patch(`/db/workflows/${id}`, data);
  }
}
