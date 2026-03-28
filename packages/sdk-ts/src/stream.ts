import type { NovaClient } from "./client";

export class NovaStream {
  constructor(private client: NovaClient) {}

  async init(channelId: string, conversationId: string) {
    return this.client.post("/stream/init", { channelId, conversationId });
  }

  async cleanup(channelId: string) {
    return this.client.post("/stream/cleanup", { channelId });
  }

  async publishToken(channelId: string, token: string) {
    return this.client.post("/stream/token", { channelId, token });
  }

  async publishToolStatus(
    channelId: string,
    tool: string,
    status: string,
    extra?: { args?: Record<string, unknown>; resultSummary?: string },
  ) {
    return this.client.post("/stream/tool-status", { channelId, tool, status, ...extra });
  }

  async publishContentClear(channelId: string, reason?: string) {
    return this.client.post("/stream/content-clear", { channelId, reason });
  }

  async publishDone(
    channelId: string,
    content: string,
    usage: { prompt_tokens?: number; completion_tokens?: number },
  ) {
    return this.client.post("/stream/done", { channelId, content, usage });
  }

  async publishError(channelId: string, message: string) {
    return this.client.post("/stream/error", { channelId, message });
  }

  async publishTierAssessed(channelId: string, tier: string, reasoning: string) {
    return this.client.post("/stream/tier-assessed", { channelId, tier, reasoning });
  }

  async publishPlanGenerated(channelId: string, plan: unknown) {
    return this.client.post("/stream/plan-generated", { channelId, plan });
  }

  async publishPlanNodeStatus(channelId: string, nodeId: string, status: string, detail?: string) {
    return this.client.post("/stream/plan-node-status", { channelId, nodeId, status, detail });
  }

  async publishResearchStatus(channelId: string, status: string, phase?: string) {
    return this.client.post("/stream/research-status", { channelId, status, phase });
  }

  async publishResearchDone(channelId: string, reportId: string, sourcesCount: number) {
    return this.client.post("/stream/research-done", { channelId, reportId, sourcesCount });
  }
}
