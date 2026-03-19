import { describe, it, expect } from "bun:test";
import { parseThinkBlocks, parseThinkBlocksComplete } from "../../src/lib/think-parser";

describe("parseThinkBlocks", () => {
  it("parses basic think block", () => {
    const result = parseThinkBlocks("<think>reasoning</think>answer");
    expect(result.visibleContent).toBe("answer");
    expect(result.thinkingContent).toBe("reasoning");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(true);
  });

  it("passes through content with no think blocks", () => {
    const result = parseThinkBlocks("just a normal response");
    expect(result.visibleContent).toBe("just a normal response");
    expect(result.thinkingContent).toBe("");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(false);
  });

  it("handles multiple think blocks", () => {
    const result = parseThinkBlocks("<think>first</think>visible<think>second</think>more");
    expect(result.visibleContent).toBe("visiblemore");
    expect(result.thinkingContent).toBe("firstsecond");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(true);
  });

  it("handles unclosed block (streaming state)", () => {
    const result = parseThinkBlocks("<think>still thinking...");
    expect(result.visibleContent).toBe("");
    expect(result.thinkingContent).toBe("still thinking...");
    expect(result.isThinking).toBe(true);
    expect(result.hasThinkingContent).toBe(true);
  });

  it("buffers partial <think> tag at end", () => {
    const result = parseThinkBlocks("hello<thi");
    expect(result.visibleContent).toBe("hello");
    expect(result.isThinking).toBe(false);
  });

  it("buffers partial </think> tag at end", () => {
    const result = parseThinkBlocks("<think>content</th");
    expect(result.thinkingContent).toBe("content");
    expect(result.isThinking).toBe(true);
  });

  it("double-opener stays in thinking during streaming", () => {
    const result = parseThinkBlocks("<think>reasoning<think>still reasoning");
    expect(result.visibleContent).toBe("");
    expect(result.thinkingContent).toBe("reasoningstill reasoning");
    expect(result.isThinking).toBe(true);
    expect(result.hasThinkingContent).toBe(true);
  });

  it("multiple double-openers keep all content as thinking", () => {
    const result = parseThinkBlocks("<think>A<think>B<think>C<think>D");
    expect(result.visibleContent).toBe("");
    expect(result.thinkingContent).toBe("ABCD");
    expect(result.isThinking).toBe(true);
  });

  it("handles < inside thinking content", () => {
    const result = parseThinkBlocks("<think>x < y and a > b</think>answer");
    expect(result.thinkingContent).toBe("x < y and a > b");
    expect(result.visibleContent).toBe("answer");
  });

  it("handles empty think block", () => {
    const result = parseThinkBlocks("<think></think>answer");
    expect(result.visibleContent).toBe("answer");
    expect(result.thinkingContent).toBe("");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(false);
  });

  it("handles empty string", () => {
    const result = parseThinkBlocks("");
    expect(result.visibleContent).toBe("");
    expect(result.thinkingContent).toBe("");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(false);
  });

  it("handles think block with newlines", () => {
    const result = parseThinkBlocks("<think>line1\nline2\nline3</think>response");
    expect(result.thinkingContent).toBe("line1\nline2\nline3");
    expect(result.visibleContent).toBe("response");
  });
});

describe("parseThinkBlocksComplete", () => {
  it("works same as parseThinkBlocks for properly closed blocks", () => {
    const result = parseThinkBlocksComplete("<think>reasoning</think>answer");
    expect(result.visibleContent).toBe("answer");
    expect(result.thinkingContent).toBe("reasoning");
    expect(result.isThinking).toBe(false);
  });

  it("handles double-opener as closer for completed messages", () => {
    const result = parseThinkBlocksComplete("<think>reasoning<think>actual answer");
    expect(result.visibleContent).toBe("actual answer");
    expect(result.thinkingContent).toBe("reasoning");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(true);
  });

  it("handles multiple double-openers — content after last <think> is visible", () => {
    const result = parseThinkBlocksComplete("<think>A<think>B<think>C<think>actual answer");
    expect(result.visibleContent).toBe("actual answer");
    expect(result.thinkingContent).toBe("ABC");
    expect(result.isThinking).toBe(false);
    expect(result.hasThinkingContent).toBe(true);
  });

  it("passes through content with no think blocks", () => {
    const result = parseThinkBlocksComplete("just a normal response");
    expect(result.visibleContent).toBe("just a normal response");
    expect(result.thinkingContent).toBe("");
    expect(result.isThinking).toBe(false);
  });

  it("handles multiple properly closed blocks", () => {
    const result = parseThinkBlocksComplete("<think>first</think>visible<think>second</think>more");
    expect(result.visibleContent).toBe("visiblemore");
    expect(result.thinkingContent).toBe("firstsecond");
    expect(result.isThinking).toBe(false);
  });
});
