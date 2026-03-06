import { describe, it, expect } from "bun:test";

describe("Markdown content processing", () => {
  it("detects mermaid code blocks", () => {
    const content = "```mermaid\ngraph TD\n  A-->B\n```";
    const match = /```mermaid\n([\s\S]*?)```/.exec(content);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe("graph TD\n  A-->B");
  });

  it("detects LaTeX inline math", () => {
    const content = "The formula $E = mc^2$ is famous";
    const match = /\$([^$]+)\$/.exec(content);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("E = mc^2");
  });

  it("detects LaTeX display math", () => {
    const content = "$$\\sum_{i=0}^{n} x_i$$";
    const match = /\$\$([\s\S]+?)\$\$/.exec(content);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("\\sum");
  });

  it("detects CSV code blocks", () => {
    const content = '```csv\nname,age\nAlice,30\nBob,25\n```';
    const match = /```csv\n([\s\S]*?)```/.exec(content);
    expect(match).not.toBeNull();
    const rows = match![1].trim().split("\n");
    expect(rows).toHaveLength(3);
  });

  it("detects language in code blocks", () => {
    const examples = [
      { input: "```python\nprint('hello')\n```", expected: "python" },
      { input: "```javascript\nconsole.log('hi')\n```", expected: "javascript" },
      { input: "```typescript\nconst x: number = 1\n```", expected: "typescript" },
    ];

    for (const { input, expected } of examples) {
      const match = /```(\w+)\n/.exec(input);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(expected);
    }
  });
});

describe("Content sanitization", () => {
  it("strips script tags from markdown", () => {
    const content = "Hello <script>alert('xss')</script> world";
    const sanitized = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    expect(sanitized).toBe("Hello  world");
    expect(sanitized).not.toContain("script");
  });

  it("strips event handlers", () => {
    const content = '<img onerror="alert(1)" src="x">';
    const sanitized = content.replace(/\s*on\w+="[^"]*"/gi, "");
    expect(sanitized).not.toContain("onerror");
  });
});
