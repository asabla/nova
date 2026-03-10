import { describe, it, expect } from "bun:test";
import { chunkContent } from "../src/content/chunker";
import { htmlToMarkdown } from "../src/content/html-to-markdown";
import { extractFromHtml } from "../src/content/html-extract";

// ---------- htmlToMarkdown ----------

describe("htmlToMarkdown", () => {
  it("converts headings to atx style", () => {
    const md = htmlToMarkdown("<h1>Title</h1><h2>Sub</h2><p>Body text</p>");
    expect(md).toContain("# Title");
    expect(md).toContain("## Sub");
    expect(md).toContain("Body text");
  });

  it("converts lists", () => {
    const md = htmlToMarkdown("<ul><li>A</li><li>B</li></ul>");
    // Turndown may use different spacing (e.g., "-   A" or "- A")
    expect(md).toMatch(/-\s+A/);
    expect(md).toMatch(/-\s+B/);
  });

  it("converts tables to GFM", () => {
    const md = htmlToMarkdown(
      "<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table>"
    );
    expect(md).toContain("| Name | Value |");
    expect(md).toContain("| a | 1 |");
  });

  it("handles fenced code blocks with language", () => {
    const md = htmlToMarkdown('<pre><code class="language-js">const x = 1;</code></pre>');
    expect(md).toContain("```js");
    expect(md).toContain("const x = 1;");
    expect(md).toContain("```");
  });

  it("collapses excessive blank lines", () => {
    const md = htmlToMarkdown("<p>A</p><br><br><br><br><p>B</p>");
    const maxConsecutiveNewlines = md.match(/\n{3,}/);
    expect(maxConsecutiveNewlines).toBeNull();
  });
});

// ---------- extractFromHtml ----------

describe("extractFromHtml", () => {
  it("extracts metadata from a well-structured page", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Test Article</title>
        <meta property="og:title" content="OG Title" />
        <meta property="og:description" content="A description" />
        <meta name="author" content="John Doe" />
        <meta property="og:site_name" content="Test Site" />
        <meta property="article:published_time" content="2025-01-15" />
      </head>
      <body>
        <nav><a href="/">Home</a></nav>
        <article>
          <h1>Article Title</h1>
          <p>This is the main content of the article. It contains enough text to be meaningful for extraction. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <p>Second paragraph with more content to ensure Readability picks it up as the main article body text for proper extraction.</p>
        </article>
        <footer>Copyright 2025</footer>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, "https://example.com/article");
    expect(result.description).toBe("A description");
    expect(result.byline).toBe("John Doe");
    expect(result.siteName).toBe("Test Site");
    expect(result.publishedDate).toBe("2025-01-15");
    expect(result.language).toBe("en");
    expect(result.sourceUrl).toBe("https://example.com/article");
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.markdown.length).toBeGreaterThan(0);
  });

  it("falls back gracefully for minimal HTML", () => {
    const html = "<p>Just some text</p>";
    const result = extractFromHtml(html);
    expect(result.markdown).toContain("Just some text");
    expect(result.wordCount).toBeGreaterThan(0);
  });

  it("strips script and style tags in fallback", () => {
    const html = `
      <html><body>
        <script>alert('xss')</script>
        <style>body { color: red; }</style>
        <p>Clean content here</p>
      </body></html>
    `;
    const result = extractFromHtml(html);
    expect(result.markdown).not.toContain("alert");
    expect(result.markdown).not.toContain("color: red");
    expect(result.markdown).toContain("Clean content");
  });

  it("handles empty HTML", () => {
    const result = extractFromHtml("");
    expect(result.wordCount).toBe(0);
  });

  it("caps large HTML input at 2MB", () => {
    // Just verify it doesn't throw on large input
    const largeHtml = "<p>" + "x".repeat(3 * 1024 * 1024) + "</p>";
    const result = extractFromHtml(largeHtml);
    expect(result.markdown.length).toBeGreaterThan(0);
  });
});

// ---------- chunkContent ----------

describe("chunkContent", () => {
  it("returns a single chunk for short content", () => {
    const chunks = chunkContent("Hello world, this is a test.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("Hello world, this is a test.");
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].metadata.chunkType).toBe("text");
  });

  it("splits on heading boundaries", () => {
    const sectionAContent = "Content for section A. ".repeat(30);
    const sectionBContent = "Content for section B. ".repeat(30);
    const md = `## Section A\n\n${sectionAContent}\n\n## Section B\n\n${sectionBContent}`;

    const chunks = chunkContent(md, { maxChunkSize: 500 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // First chunk should contain Section A heading
    expect(chunks[0].text).toContain("Section A");
    expect(chunks[0].metadata.sectionHeading).toBe("Section A");

    // A later chunk should contain Section B heading
    const sectionB = chunks.find((c) => c.metadata.sectionHeading === "Section B");
    expect(sectionB).toBeDefined();
    expect(sectionB!.text).toContain("Section B");
  });

  it("tracks heading hierarchy", () => {
    const md = `# Main Title

## Sub Section

### Deep Section

Deep content here.`;

    const chunks = chunkContent(md, { maxChunkSize: 500 });
    const deepChunk = chunks.find((c) => c.text.includes("Deep content"));
    expect(deepChunk).toBeDefined();
    expect(deepChunk!.metadata.headingHierarchy).toContain("Main Title");
    expect(deepChunk!.metadata.headingHierarchy).toContain("Sub Section");
    expect(deepChunk!.metadata.headingHierarchy).toContain("Deep Section");
  });

  it("splits oversized sections at paragraph boundaries", () => {
    const longSection =
      "## Long Section\n\n" +
      Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} with enough text to fill up space. `.repeat(5))
        .join("\n\n");

    const chunks = chunkContent(longSection, { maxChunkSize: 500 });
    expect(chunks.length).toBeGreaterThan(1);

    // All chunks should be within size limits (with some tolerance for heading prepending)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(500 * 1.2 + 50);
    }
  });

  it("preserves code blocks intact up to 2x limit", () => {
    const codeBlock = "```python\n" + "x = 1\n".repeat(50) + "```";
    const md = `## Code Example\n\n${codeBlock}`;

    const chunks = chunkContent(md, { maxChunkSize: 200 });
    // The code block should be in a single chunk since it's under 2x limit
    const codeChunk = chunks.find((c) => c.text.includes("```python"));
    expect(codeChunk).toBeDefined();
    expect(codeChunk!.text).toContain("x = 1");
    expect(codeChunk!.metadata.chunkType).toBe("code");
  });

  it("preserves tables intact up to 2x limit", () => {
    const table = "| Col A | Col B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    const md = `## Data\n\n${table}`;

    const chunks = chunkContent(md, { maxChunkSize: 200 });
    const tableChunk = chunks.find((c) => c.text.includes("| Col A |"));
    expect(tableChunk).toBeDefined();
    expect(tableChunk!.text).toContain("| 3 | 4 |");
    expect(tableChunk!.metadata.chunkType).toBe("table");
  });

  it("includes position ratio in metadata", () => {
    const contentA = "First section content. ".repeat(20);
    const contentB = "Middle section content. ".repeat(20);
    const contentC = "Last section content. ".repeat(20);
    const md = `## A\n\n${contentA}\n\n## B\n\n${contentB}\n\n## C\n\n${contentC}`;
    const chunks = chunkContent(md, { maxChunkSize: 300 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].metadata.positionRatio).toBe(0);
    // Last chunk should have highest ratio
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.metadata.positionRatio).toBeGreaterThan(0);
  });

  it("handles empty content", () => {
    const chunks = chunkContent("");
    // Empty string may produce 0 or 1 chunk depending on trimming
    expect(chunks.length).toBeLessThanOrEqual(1);
    if (chunks.length === 1) {
      expect(chunks[0].text.trim()).toBe("");
    }
  });

  it("handles content with no headings", () => {
    const text = "Just plain text without any headings. ".repeat(10);
    const chunks = chunkContent(text, { maxChunkSize: 200 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.metadata.headingHierarchy).toEqual([]);
    }
  });

  it("respects custom chunk options", () => {
    const text = "Word. ".repeat(500);
    const chunks = chunkContent(text, { maxChunkSize: 300, minChunkSize: 50, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Allow some tolerance
      expect(chunk.text.length).toBeLessThanOrEqual(300 * 1.3);
    }
  });
});
