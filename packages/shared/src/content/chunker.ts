import type { ContentChunk, ChunkMetadata, ChunkOptions } from "./types.js";

const DEFAULTS: Required<ChunkOptions> = {
  maxChunkSize: 1500,
  minChunkSize: 100,
  overlap: 150,
  preserveTables: true,
};

interface Section {
  heading: string | null;
  headingLevel: number;
  content: string;
  headingHierarchy: string[];
}

/**
 * Pass 1: Split markdown on heading boundaries, tracking heading hierarchy.
 */
function splitIntoSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentContent: string[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  const headingStack: { level: number; text: string }[] = [];

  function pushSection() {
    const content = currentContent.join("\n").trim();
    if (content.length > 0) {
      sections.push({
        heading: currentHeading,
        headingLevel: currentLevel,
        content,
        headingHierarchy: headingStack.map((h) => h.text),
      });
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Flush previous section
      pushSection();
      currentContent = [];

      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();

      // Update heading stack: pop headings at same or deeper level
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text });

      currentHeading = text;
      currentLevel = level;
    } else {
      currentContent.push(line);
    }
  }

  // Flush last section
  pushSection();

  return sections;
}

/**
 * Detect if text is a code block or table.
 */
function detectChunkType(text: string): ChunkMetadata["chunkType"] {
  const trimmed = text.trim();
  const codeBlockCount = (trimmed.match(/```/g) ?? []).length;
  const hasTable = /^\|.+\|$/m.test(trimmed) && /^\|[-:| ]+\|$/m.test(trimmed);

  if (codeBlockCount >= 2 && !hasTable) return "code";
  if (hasTable && codeBlockCount === 0) return "table";
  if (hasTable || codeBlockCount >= 2) return "mixed";
  return "text";
}

/**
 * Check if a block is a preserved block (table or code) that shouldn't be split.
 */
function isPreservedBlock(text: string): boolean {
  const trimmed = text.trim();
  // Complete code block
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) return true;
  // Table (has pipes and header separator)
  if (/^\|.+\|$/m.test(trimmed) && /^\|[-:| ]+\|$/m.test(trimmed)) return true;
  return false;
}

/**
 * Split text at sentence boundaries.
 */
function splitAtSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or newline
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim().length > 0);
}

/**
 * Pass 2: Recursively split oversized sections.
 * Splits by: paragraphs → lines → sentences.
 * Tables and code blocks are kept intact up to 2x limit.
 */
function splitOversized(text: string, maxSize: number, preserveTables: boolean): string[] {
  if (text.length <= maxSize) return [text];

  // Preserved blocks (tables/code) can go up to 2x
  if (preserveTables && isPreservedBlock(text) && text.length <= maxSize * 2) {
    return [text];
  }

  // Try splitting by double newline (paragraphs)
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    return mergeSmallParts(paragraphs, maxSize, preserveTables);
  }

  // Try splitting by single newline
  const lines = text.split(/\n/);
  if (lines.length > 1) {
    return mergeSmallParts(lines, maxSize, preserveTables);
  }

  // Split by sentences
  const sentences = splitAtSentences(text);
  if (sentences.length > 1) {
    return mergeSmallParts(sentences, maxSize, preserveTables);
  }

  // Last resort: hard split at maxSize
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxSize) {
    chunks.push(text.slice(i, i + maxSize));
  }
  return chunks;
}

/**
 * Merge small parts back together up to maxSize.
 */
function mergeSmallParts(parts: string[], maxSize: number, preserveTables: boolean): string[] {
  const result: string[] = [];
  let current = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // If this single part is oversized, recursively split it
    if (trimmed.length > maxSize) {
      if (current.trim()) {
        result.push(current.trim());
        current = "";
      }
      result.push(...splitOversized(trimmed, maxSize, preserveTables));
      continue;
    }

    const separator = current ? "\n\n" : "";
    if (current.length + separator.length + trimmed.length <= maxSize) {
      current += separator + trimmed;
    } else {
      if (current.trim()) {
        result.push(current.trim());
      }
      current = trimmed;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Chunk markdown content semantically.
 *
 * Algorithm:
 * 1. Split on heading boundaries, tracking heading hierarchy
 * 2. Enforce max size by splitting large sections (paragraphs → lines → sentences)
 * 3. At section boundaries, prepend section heading for context;
 *    within sections, use character overlap
 */
export function chunkContent(markdown: string, options?: ChunkOptions): ContentChunk[] {
  const opts = { ...DEFAULTS, ...options };
  const sections = splitIntoSections(markdown);
  const chunks: ContentChunk[] = [];
  let globalIndex = 0;
  const totalLength = markdown.length;

  let charOffset = 0;

  for (const section of sections) {
    const parts = splitOversized(section.content, opts.maxChunkSize, opts.preserveTables);

    for (let i = 0; i < parts.length; i++) {
      let text = parts[i];

      // Prepend section heading for context at section boundaries
      if (i === 0 && section.heading) {
        const headingPrefix = `${"#".repeat(section.headingLevel)} ${section.heading}\n\n`;
        // Only prepend if it doesn't push us way over the limit
        if (text.length + headingPrefix.length <= opts.maxChunkSize * 1.2) {
          text = headingPrefix + text;
        }
      } else if (i > 0 && opts.overlap > 0) {
        // Within-section overlap: prepend tail of previous chunk
        const prevText = parts[i - 1];
        const overlapText = prevText.slice(-opts.overlap);
        // Find a clean break point in the overlap
        const cleanBreak = overlapText.indexOf(" ");
        const cleanOverlap = cleanBreak > 0 ? overlapText.slice(cleanBreak + 1) : overlapText;
        if (cleanOverlap.length > 0 && text.length + cleanOverlap.length + 4 <= opts.maxChunkSize * 1.2) {
          text = cleanOverlap + "\n\n" + text;
        }
      }

      // Skip chunks that are too small (unless it's the only content)
      if (text.trim().length < opts.minChunkSize && chunks.length > 0 && globalIndex < sections.length - 1) {
        charOffset += parts[i].length;
        continue;
      }

      const positionRatio = totalLength > 0 ? Math.min(charOffset / totalLength, 1) : 0;

      const metadata: ChunkMetadata = {
        headingHierarchy: [...section.headingHierarchy],
        sectionHeading: section.heading ?? undefined,
        positionRatio: Math.round(positionRatio * 1000) / 1000,
        chunkType: detectChunkType(text),
      };

      chunks.push({
        text: text.trim(),
        index: globalIndex,
        metadata,
      });

      globalIndex++;
      charOffset += parts[i].length;
    }
  }

  return chunks;
}
