import { describe, it, expect } from "bun:test";

/**
 * Unit tests for MessageInput component logic.
 *
 * Tests the submit validation logic, draft key generation,
 * and keyboard handling behavior without rendering React components.
 */

describe("MessageInput submit logic", () => {
  // Mirrors handleSubmit validation logic
  function shouldSubmit(content: string, pendingFilesCount: number, disabled: boolean): boolean {
    const trimmed = content.trim();
    if ((!trimmed && pendingFilesCount === 0) || disabled) return false;
    return true;
  }

  it("allows submit with text content", () => {
    expect(shouldSubmit("Hello", 0, false)).toBe(true);
  });

  it("allows submit with only files", () => {
    expect(shouldSubmit("", 1, false)).toBe(true);
  });

  it("allows submit with text and files", () => {
    expect(shouldSubmit("Hello", 2, false)).toBe(true);
  });

  it("blocks submit when empty and no files", () => {
    expect(shouldSubmit("", 0, false)).toBe(false);
  });

  it("blocks submit when whitespace-only and no files", () => {
    expect(shouldSubmit("   ", 0, false)).toBe(false);
  });

  it("blocks submit when disabled", () => {
    expect(shouldSubmit("Hello", 0, true)).toBe(false);
  });

  it("blocks submit when disabled even with files", () => {
    expect(shouldSubmit("Hello", 3, true)).toBe(false);
  });

  it("trims content before checking", () => {
    expect(shouldSubmit("  Hello  ", 0, false)).toBe(true);
  });
});

describe("Draft key generation", () => {
  function getDraftKey(conversationId?: string): string {
    return conversationId ? `nova:message-draft:${conversationId}` : "nova:message-draft";
  }

  it("generates key with conversation id", () => {
    expect(getDraftKey("abc-123")).toBe("nova:message-draft:abc-123");
  });

  it("generates fallback key without conversation id", () => {
    expect(getDraftKey()).toBe("nova:message-draft");
  });

  it("generates fallback key for undefined", () => {
    expect(getDraftKey(undefined)).toBe("nova:message-draft");
  });
});

describe("Keyboard handling logic", () => {
  // Simulates key event decisions
  function shouldSubmitOnKeyDown(
    key: string,
    shiftKey: boolean,
    isStreaming: boolean,
    mentionActive: boolean,
  ): "submit" | "newline" | "ignore" | "mention" {
    if (mentionActive) {
      if (key === "Enter" || key === "Tab") return "mention";
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Escape") return "mention";
    }

    if (key === "Enter" && !shiftKey) {
      if (isStreaming) return "ignore";
      return "submit";
    }

    if (key === "Enter" && shiftKey) {
      return "newline";
    }

    return "ignore";
  }

  it("Enter submits message", () => {
    expect(shouldSubmitOnKeyDown("Enter", false, false, false)).toBe("submit");
  });

  it("Shift+Enter creates new line", () => {
    expect(shouldSubmitOnKeyDown("Enter", true, false, false)).toBe("newline");
  });

  it("Enter during streaming is ignored", () => {
    expect(shouldSubmitOnKeyDown("Enter", false, true, false)).toBe("ignore");
  });

  it("Enter during active mention handles mention", () => {
    expect(shouldSubmitOnKeyDown("Enter", false, false, true)).toBe("mention");
  });

  it("Tab during active mention handles mention", () => {
    expect(shouldSubmitOnKeyDown("Tab", false, false, true)).toBe("mention");
  });

  it("ArrowDown during active mention handles mention", () => {
    expect(shouldSubmitOnKeyDown("ArrowDown", false, false, true)).toBe("mention");
  });

  it("regular key press is ignored", () => {
    expect(shouldSubmitOnKeyDown("a", false, false, false)).toBe("ignore");
  });
});

describe("Send button disabled state", () => {
  function isSendDisabled(content: string, pendingFilesCount: number, disabled: boolean): boolean {
    return (!content.trim() && pendingFilesCount === 0) || disabled;
  }

  it("enabled when content present", () => {
    expect(isSendDisabled("Hello", 0, false)).toBe(false);
  });

  it("enabled when files present", () => {
    expect(isSendDisabled("", 1, false)).toBe(false);
  });

  it("disabled when no content and no files", () => {
    expect(isSendDisabled("", 0, false)).toBe(true);
  });

  it("disabled when component disabled", () => {
    expect(isSendDisabled("Hello", 0, true)).toBe(true);
  });
});
