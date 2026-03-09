import { describe, it, expect, mock, beforeEach } from "bun:test";

/**
 * Unit tests for the SSE streaming state machine.
 *
 * Since useSSE is a React hook that relies on useState/useCallback, we test the
 * core state transition logic here by verifying the expected behaviors:
 *
 * State machine:
 *   idle → streaming → done → idle
 *   idle → streaming → error → idle (after reset)
 *   idle → streaming → paused → streaming → done → idle
 *   streaming → (abort) → done
 */

describe("SSE stream state machine", () => {
  // Simulate the state machine without React hooks
  type Status = "idle" | "streaming" | "paused" | "done" | "error";

  function createStreamMachine() {
    let status: Status = "idle";
    let tokens = "";
    let paused = false;
    let buffer = "";

    return {
      getStatus: () => status,
      getTokens: () => tokens,

      startStream: () => {
        tokens = "";
        status = "streaming";
        paused = false;
        buffer = "";
      },

      receiveToken: (content: string) => {
        if (paused) {
          buffer += content;
        } else {
          tokens += content;
        }
      },

      receiveDone: () => {
        if (buffer) {
          tokens += buffer;
          buffer = "";
        }
        status = "done";
      },

      receiveError: () => {
        status = "error";
      },

      pause: () => {
        paused = true;
        status = "paused";
      },

      resume: () => {
        paused = false;
        if (buffer) {
          tokens += buffer;
          buffer = "";
        }
        status = "streaming";
      },

      stop: () => {
        if (buffer) {
          tokens += buffer;
          buffer = "";
        }
        status = "done";
      },

      reset: () => {
        tokens = "";
        status = "idle";
        buffer = "";
      },
    };
  }

  it("starts in idle state", () => {
    const sm = createStreamMachine();
    expect(sm.getStatus()).toBe("idle");
    expect(sm.getTokens()).toBe("");
  });

  it("transitions to streaming on start", () => {
    const sm = createStreamMachine();
    sm.startStream();
    expect(sm.getStatus()).toBe("streaming");
    expect(sm.getTokens()).toBe("");
  });

  it("accumulates tokens during streaming", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("Hello ");
    sm.receiveToken("world");
    expect(sm.getTokens()).toBe("Hello world");
    expect(sm.getStatus()).toBe("streaming");
  });

  it("transitions to done on completion", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("Response");
    sm.receiveDone();
    expect(sm.getStatus()).toBe("done");
    expect(sm.getTokens()).toBe("Response");
  });

  it("transitions to error on failure", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveError();
    expect(sm.getStatus()).toBe("error");
  });

  it("resets back to idle", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("partial");
    sm.receiveError();
    sm.reset();
    expect(sm.getStatus()).toBe("idle");
    expect(sm.getTokens()).toBe("");
  });

  it("buffers tokens while paused", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("before ");
    sm.pause();
    expect(sm.getStatus()).toBe("paused");

    sm.receiveToken("during ");
    sm.receiveToken("pause ");
    // Tokens should NOT include paused content yet
    expect(sm.getTokens()).toBe("before ");
  });

  it("flushes buffer on resume", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("before ");
    sm.pause();
    sm.receiveToken("during ");
    sm.resume();
    expect(sm.getStatus()).toBe("streaming");
    expect(sm.getTokens()).toBe("before during ");
  });

  it("flushes buffer on done while paused", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("before ");
    sm.pause();
    sm.receiveToken("after ");
    sm.receiveDone();
    expect(sm.getStatus()).toBe("done");
    expect(sm.getTokens()).toBe("before after ");
  });

  it("flushes buffer on stop", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("start ");
    sm.pause();
    sm.receiveToken("paused ");
    sm.stop();
    expect(sm.getStatus()).toBe("done");
    expect(sm.getTokens()).toBe("start paused ");
  });

  it("clears previous state on new startStream", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveToken("first response");
    sm.receiveDone();

    sm.startStream();
    expect(sm.getTokens()).toBe("");
    expect(sm.getStatus()).toBe("streaming");
  });

  it("handles done with no tokens (error recovery)", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveDone();
    expect(sm.getStatus()).toBe("done");
    expect(sm.getTokens()).toBe("");
  });

  it("error followed by reset allows new stream", () => {
    const sm = createStreamMachine();
    sm.startStream();
    sm.receiveError();
    expect(sm.getStatus()).toBe("error");

    sm.reset();
    expect(sm.getStatus()).toBe("idle");

    sm.startStream();
    sm.receiveToken("retry works");
    sm.receiveDone();
    expect(sm.getTokens()).toBe("retry works");
    expect(sm.getStatus()).toBe("done");
  });
});

describe("SSE event parsing", () => {
  function parseSSELine(line: string): { type: "event" | "data" | "other"; value: string } {
    if (line.startsWith("event: ")) {
      return { type: "event", value: line.slice(7).trim() };
    }
    if (line.startsWith("data: ")) {
      return { type: "data", value: line.slice(6) };
    }
    return { type: "other", value: line };
  }

  it("parses event lines", () => {
    const result = parseSSELine("event: token");
    expect(result.type).toBe("event");
    expect(result.value).toBe("token");
  });

  it("parses data lines with JSON", () => {
    const result = parseSSELine('data: {"content":"hello"}');
    expect(result.type).toBe("data");
    const data = JSON.parse(result.value);
    expect(data.content).toBe("hello");
  });

  it("parses done event", () => {
    const result = parseSSELine("event: done");
    expect(result.type).toBe("event");
    expect(result.value).toBe("done");
  });

  it("parses error event", () => {
    const result = parseSSELine("event: error");
    expect(result.type).toBe("event");
    expect(result.value).toBe("error");
  });

  it("parses tool_status event data", () => {
    const result = parseSSELine('data: {"tool":"web_search","status":"running"}');
    expect(result.type).toBe("data");
    const data = JSON.parse(result.value);
    expect(data.tool).toBe("web_search");
    expect(data.status).toBe("running");
  });

  it("handles empty lines", () => {
    const result = parseSSELine("");
    expect(result.type).toBe("other");
  });

  it("handles heartbeat events", () => {
    const result = parseSSELine("event: heartbeat");
    expect(result.type).toBe("event");
    expect(result.value).toBe("heartbeat");
  });
});

describe("Message history building", () => {
  // Mirrors the logic in conversations.$id.tsx handleSend
  function buildMessageHistory(
    messages: { senderType: string; content: string | null }[],
    newContent: string,
    systemPrompt?: string,
  ) {
    return [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages
        .filter((m) => m.content != null && m.content !== "")
        .map((m) => ({
          role: m.senderType === "user" ? "user" : "assistant",
          content: m.content!,
        })),
      { role: "user", content: newContent },
    ];
  }

  it("builds basic message history", () => {
    const result = buildMessageHistory(
      [
        { senderType: "user", content: "Hello" },
        { senderType: "assistant", content: "Hi there!" },
      ],
      "How are you?",
    );
    expect(result).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ]);
  });

  it("prepends system prompt when provided", () => {
    const result = buildMessageHistory([], "Hello", "You are helpful.");
    expect(result).toEqual([
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ]);
  });

  it("filters out null content messages", () => {
    const result = buildMessageHistory(
      [
        { senderType: "user", content: "Hello" },
        { senderType: "assistant", content: null },
        { senderType: "user", content: "Try again" },
      ],
      "Please respond",
    );
    expect(result).toEqual([
      { role: "user", content: "Hello" },
      { role: "user", content: "Try again" },
      { role: "user", content: "Please respond" },
    ]);
  });

  it("filters out empty string content messages", () => {
    const result = buildMessageHistory(
      [
        { senderType: "user", content: "Hello" },
        { senderType: "assistant", content: "" },
      ],
      "Still there?",
    );
    expect(result).toEqual([
      { role: "user", content: "Hello" },
      { role: "user", content: "Still there?" },
    ]);
  });

  it("maps tool/system senderType to assistant role", () => {
    const result = buildMessageHistory(
      [
        { senderType: "user", content: "Search for X" },
        { senderType: "tool", content: "Tool result" },
        { senderType: "system", content: "System note" },
      ],
      "Thanks",
    );
    expect(result[1].role).toBe("assistant");
    expect(result[2].role).toBe("assistant");
  });

  it("handles empty conversation history", () => {
    const result = buildMessageHistory([], "First message");
    expect(result).toEqual([{ role: "user", content: "First message" }]);
  });
});
