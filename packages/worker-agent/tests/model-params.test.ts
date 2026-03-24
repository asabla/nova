import { describe, it, expect } from "bun:test";

/**
 * Tests for reasoning model parameter handling.
 *
 * Problem: The OpenAI Agent SDK always sends max_tokens, temperature, etc.
 * in API requests — even when undefined. Reasoning models (o1, o3, gpt-5.4)
 * reject these params entirely.
 *
 * Solution: wrapClientWithParamFilter() wraps the OpenAI client to strip
 * dropped params from chat.completions.create() calls.
 *
 * Note: The Agent SDK (@openai/agents-openai) has a Zod initialization bug
 * in Bun's test runtime, so we test the proxy logic directly without
 * importing the SDK. The full integration is validated in Docker (Node.js).
 */

// Import the testable proxy function directly
import { wrapClientWithParamFilter } from "../src/reasoning-model";

// ─── Unit: dropParams logic ─────────────────────────────

describe("dropParams logic (unit)", () => {
  const GPT54_DROP_PARAMS = [
    "temperature", "top_p", "presence_penalty", "frequency_penalty",
    "logprobs", "top_logprobs", "parallel_tool_calls", "max_tokens",
  ];

  // Inline version for pure unit testing
  function applyDropParams(params: Record<string, unknown>, dropParams: string[]): Record<string, unknown> {
    const result = { ...params };
    for (const param of dropParams) {
      delete result[param];
    }
    return result;
  }

  it("strips all reasoning model params from a request", () => {
    const input = {
      model: "gpt-5.4",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
    };

    const result = applyDropParams(input, GPT54_DROP_PARAMS);

    expect(result).not.toHaveProperty("temperature");
    expect(result).not.toHaveProperty("max_tokens");
    expect(result).not.toHaveProperty("top_p");
    expect(result).not.toHaveProperty("presence_penalty");
    expect(result).not.toHaveProperty("frequency_penalty");
    expect(result).toHaveProperty("model", "gpt-5.4");
    expect(result).toHaveProperty("messages");
  });

  it("preserves all params when dropParams is empty", () => {
    const input = { model: "gpt-4o", temperature: 0.7, max_tokens: 4096 };
    const result = applyDropParams(input, []);
    expect(result).toEqual(input);
  });

  it("strips keys even when values are undefined (SDK sends max_tokens: undefined)", () => {
    const input: Record<string, unknown> = {
      model: "gpt-5.4",
      messages: [],
      temperature: undefined,
      max_tokens: undefined,
    };

    expect("max_tokens" in input).toBe(true);
    expect("temperature" in input).toBe(true);

    const result = applyDropParams(input, GPT54_DROP_PARAMS);

    expect("max_tokens" in result).toBe(false);
    expect("temperature" in result).toBe(false);
  });
});

// ─── Integration: OpenAI client proxy ───────────────────

describe("wrapClientWithParamFilter (integration)", () => {
  function createMockClient() {
    let captured: any = null;
    const client = {
      chat: {
        completions: {
          create: async (params: any) => {
            captured = params;
            return {
              id: "test",
              choices: [{ message: { content: "hi", role: "assistant" }, index: 0, finish_reason: "stop" }],
              model: "gpt-5.4",
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            };
          },
        },
      },
      baseURL: "https://api.openai.com/v1",
    };
    return { client, getCaptured: () => captured };
  }

  const DROP_PARAMS = [
    "temperature", "max_tokens", "top_p",
    "presence_penalty", "frequency_penalty", "parallel_tool_calls",
  ];

  it("strips dropped params from chat.completions.create calls", async () => {
    const { client, getCaptured } = createMockClient();
    const wrapped = wrapClientWithParamFilter(client as any, DROP_PARAMS);

    await wrapped.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      parallel_tool_calls: true,
      stream: true,
      stream_options: { include_usage: true },
    } as any);

    const captured = getCaptured();
    expect(captured).not.toBeNull();

    // Dropped params must not be present
    expect("max_tokens" in captured).toBe(false);
    expect("temperature" in captured).toBe(false);
    expect("top_p" in captured).toBe(false);
    expect("presence_penalty" in captured).toBe(false);
    expect("frequency_penalty" in captured).toBe(false);
    expect("parallel_tool_calls" in captured).toBe(false);

    // Non-dropped params must be preserved
    expect(captured.model).toBe("gpt-5.4");
    expect(captured.messages).toHaveLength(1);
    expect(captured.stream).toBe(true);
    expect(captured.stream_options).toEqual({ include_usage: true });
  });

  it("strips params even when values are undefined", async () => {
    const { client, getCaptured } = createMockClient();
    const wrapped = wrapClientWithParamFilter(client as any, DROP_PARAMS);

    // This is exactly what the Agent SDK sends for reasoning models
    await wrapped.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "hello" }],
      temperature: undefined,
      max_tokens: undefined,
      top_p: undefined,
      presence_penalty: undefined,
      frequency_penalty: undefined,
      stream: true,
    } as any);

    const captured = getCaptured();
    expect("max_tokens" in captured).toBe(false);
    expect("temperature" in captured).toBe(false);
    expect(captured.model).toBe("gpt-5.4");
    expect(captured.stream).toBe(true);
  });

  it("passes all params through when dropParams is empty", async () => {
    const { client, getCaptured } = createMockClient();
    const wrapped = wrapClientWithParamFilter(client as any, []);

    await wrapped.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.7,
      max_tokens: 4096,
    } as any);

    const captured = getCaptured();
    expect(captured.temperature).toBe(0.7);
    expect(captured.max_tokens).toBe(4096);
    expect(captured.model).toBe("gpt-4o");
  });

  it("preserves non-chat client properties", () => {
    const { client } = createMockClient();
    const wrapped = wrapClientWithParamFilter(client as any, DROP_PARAMS);

    expect(wrapped.baseURL).toBe("https://api.openai.com/v1");
  });
});
