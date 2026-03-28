import { NovaStream } from "./stream";
import { NovaDB } from "./db";
import { NovaLLM } from "./llm";
import { NovaVectors } from "./vectors";
import { NovaStorage } from "./storage";

export interface NovaClientOptions {
  /** Gateway base URL. Defaults to NOVA_GATEWAY_URL env var or http://gateway:3001 */
  gatewayUrl?: string;
  /** JWT token for gateway auth. Defaults to NOVA_GATEWAY_TOKEN env var */
  token?: string;
}

/**
 * Nova SDK client — provides access to all Gateway APIs.
 * Zero native dependencies. Uses only fetch + types.
 *
 * Usage:
 *   const nova = new NovaClient({ token: "..." });
 *   await nova.stream.publishToken(channelId, "Hello");
 *   const messages = await nova.db.getMessages(conversationId);
 *   const result = await nova.llm.chatCompletion({ model: "gpt-4", messages: [...] });
 */
export class NovaClient {
  readonly baseUrl: string;
  readonly token: string;

  readonly stream: NovaStream;
  readonly db: NovaDB;
  readonly llm: NovaLLM;
  readonly vectors: NovaVectors;
  readonly storage: NovaStorage;

  constructor(opts?: NovaClientOptions) {
    this.baseUrl = (opts?.gatewayUrl ?? process.env.NOVA_GATEWAY_URL ?? "http://gateway:3001").replace(/\/$/, "");
    this.token = opts?.token ?? process.env.NOVA_GATEWAY_TOKEN ?? "";

    this.stream = new NovaStream(this);
    this.db = new NovaDB(this);
    this.llm = new NovaLLM(this);
    this.vectors = new NovaVectors(this);
    this.storage = new NovaStorage(this);
  }

  /** Make an authenticated request to the gateway. */
  async fetch(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GatewayError(response.status, body, path);
    }

    return response;
  }

  /** Make a JSON POST request. */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const response = await this.fetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
  }

  /** Make a JSON GET request. */
  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path;
    const response = await this.fetch(url);
    return response.json() as Promise<T>;
  }

  /** Make a JSON PATCH request. */
  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const response = await this.fetch(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return response.json() as Promise<T>;
  }
}

export class GatewayError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`Gateway ${status} on ${path}: ${body}`);
    this.name = "GatewayError";
  }
}
