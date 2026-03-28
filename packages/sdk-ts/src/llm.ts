import type { NovaClient } from "./client";

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  stream?: boolean;
}

export class NovaLLM {
  constructor(private client: NovaClient) {}

  /** Non-streaming chat completion. */
  async chatCompletion(req: ChatCompletionRequest) {
    return this.client.post("/llm/chat/completions", { ...req, stream: false });
  }

  /**
   * Streaming chat completion. Returns a ReadableStream of SSE chunks.
   * Each chunk is a JSON string following OpenAI's streaming format.
   */
  async chatCompletionStream(req: Omit<ChatCompletionRequest, "stream">): Promise<ReadableStream> {
    const response = await this.client.fetch("/llm/chat/completions", {
      method: "POST",
      body: JSON.stringify({ ...req, stream: true }),
    });
    if (!response.body) throw new Error("No response body for streaming completion");
    return response.body;
  }

  /** Generate embeddings for one or more texts. */
  async embed(input: string | string[], model?: string) {
    return this.client.post("/llm/embeddings", { input, model });
  }

  /** Get default model IDs from the database. */
  async getDefaultModels(): Promise<{ chat: string; embedding: string; vision: string | null }> {
    return this.client.get("/llm/models/default");
  }
}
