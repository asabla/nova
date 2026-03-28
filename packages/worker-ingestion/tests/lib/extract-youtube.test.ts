import { describe, it, expect } from "bun:test";
import {
  isYouTubeUrl,
  extractYouTubeVideoId,
  parseChapters,
  formatMs,
  chunkTranscriptWithTimestamps,
  assembleTranscriptMarkdown,
  type TranscriptSegment,
  type YouTubeChapter,
} from "../../src/lib/extract-youtube";

// ── URL Detection ──

describe("isYouTubeUrl", () => {
  it("matches standard watch URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("matches short URLs", () => {
    expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("matches embed URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(true);
  });

  it("matches shorts URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(true);
  });

  it("rejects non-YouTube URLs", () => {
    expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false);
    expect(isYouTubeUrl("https://example.com")).toBe(false);
  });
});

describe("extractYouTubeVideoId", () => {
  it("extracts ID from various URL formats", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://example.com")).toBeNull();
  });
});

// ── Chapter Parsing ──

describe("parseChapters", () => {
  it("parses chapters from a description", () => {
    const description = `Check out my new video!

0:00 Introduction
1:30 Main Topic
5:45 Deep Dive
10:00 Conclusion`;

    const chapters = parseChapters(description);
    expect(chapters).toHaveLength(4);
    expect(chapters[0]).toEqual({ title: "Introduction", startMs: 0 });
    expect(chapters[1]).toEqual({ title: "Main Topic", startMs: 90_000 });
    expect(chapters[2]).toEqual({ title: "Deep Dive", startMs: 345_000 });
    expect(chapters[3]).toEqual({ title: "Conclusion", startMs: 600_000 });
  });

  it("parses HH:MM:SS format", () => {
    const description = `0:00 Start
1:30:00 Middle`;

    const chapters = parseChapters(description);
    expect(chapters).toHaveLength(2);
    expect(chapters[1]).toEqual({ title: "Middle", startMs: 5_400_000 });
  });

  it("returns empty array if first timestamp is not 0:00", () => {
    const description = `1:00 First Topic
2:00 Second Topic`;

    expect(parseChapters(description)).toEqual([]);
  });

  it("returns empty array for description without timestamps", () => {
    expect(parseChapters("Just a regular description with no chapters.")).toEqual([]);
  });
});

// ── formatMs ──

describe("formatMs", () => {
  it("formats minutes and seconds", () => {
    expect(formatMs(0)).toBe("0:00");
    expect(formatMs(90_000)).toBe("1:30");
    expect(formatMs(65_000)).toBe("1:05");
  });

  it("formats hours", () => {
    expect(formatMs(3_661_000)).toBe("1:01:01");
  });
});

// ── Transcript Chunking ──

function makeSegments(count: number, durationMs: number = 5000): TranscriptSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Segment ${i} with some content that represents speech.`,
    offsetMs: i * durationMs,
    durationMs,
  }));
}

describe("chunkTranscriptWithTimestamps", () => {
  it("chunks by chapters when chapters exist", () => {
    const segments = makeSegments(20); // 20 segments, 5s each = 100s total
    const chapters: YouTubeChapter[] = [
      { title: "Intro", startMs: 0 },
      { title: "Main", startMs: 50_000 }, // starts at segment 10
    ];

    const chunks = chunkTranscriptWithTimestamps(segments, chapters, "testVideoId");

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // First chunk should be from Intro chapter
    expect(chunks[0].metadata.chapterTitle).toBe("Intro");
    expect(chunks[0].metadata.chunkType).toBe("transcript");
    expect(chunks[0].metadata.startTimeMs).toBe(0);
    expect(chunks[0].metadata.timestampUrl).toBe("https://www.youtube.com/watch?v=testVideoId&t=0");

    // Find first Main chapter chunk
    const mainChunk = chunks.find((c) => c.metadata.chapterTitle === "Main");
    expect(mainChunk).toBeDefined();
    expect(mainChunk!.metadata.startTimeMs).toBe(50_000);
    expect(mainChunk!.metadata.timestampUrl).toBe("https://www.youtube.com/watch?v=testVideoId&t=50");
  });

  it("chunks by size when no chapters exist", () => {
    const segments = makeSegments(10);
    const chunks = chunkTranscriptWithTimestamps(segments, [], "vid123");

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.metadata.chunkType).toBe("transcript");
      expect(chunk.metadata.timestampUrl).toContain("vid123");
      expect(chunk.metadata.startTimeMs).toBeDefined();
      expect(chunk.metadata.endTimeMs).toBeDefined();
      expect(chunk.metadata.endTimeMs!).toBeGreaterThan(chunk.metadata.startTimeMs!);
    }
  });

  it("splits large chapters into multiple chunks", () => {
    // Create segments with long text to force splitting
    const segments = Array.from({ length: 100 }, (_, i) => ({
      text: `This is a longer segment number ${i} with enough words to accumulate characters quickly and force the chunker to split.`,
      offsetMs: i * 3000,
      durationMs: 3000,
    }));
    const chapters: YouTubeChapter[] = [
      { title: "Only Chapter", startMs: 0 },
    ];

    const chunks = chunkTranscriptWithTimestamps(segments, chapters, "vid", { maxChunkSize: 500 });

    // With 100 segments of ~100 chars each, maxChunkSize 500 should produce multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should be from the same chapter
    for (const chunk of chunks) {
      expect(chunk.metadata.chapterTitle).toBe("Only Chapter");
    }
  });

  it("returns empty array for no segments", () => {
    expect(chunkTranscriptWithTimestamps([], [], "vid")).toEqual([]);
  });

  it("assigns sequential chunk indices", () => {
    const segments = makeSegments(20);
    const chunks = chunkTranscriptWithTimestamps(segments, [], "vid");
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });
});

// ── Markdown Assembly ──

describe("assembleTranscriptMarkdown", () => {
  it("inserts chapter headings", () => {
    const segments: TranscriptSegment[] = [
      { text: "Hello everyone.", offsetMs: 0, durationMs: 3000 },
      { text: "Welcome to the tutorial.", offsetMs: 3000, durationMs: 4000 },
      { text: "Now let's dive in.", offsetMs: 60_000, durationMs: 3000 },
    ];
    const chapters: YouTubeChapter[] = [
      { title: "Intro", startMs: 0 },
      { title: "Deep Dive", startMs: 60_000 },
    ];

    const md = assembleTranscriptMarkdown(segments, chapters);
    expect(md).toContain("## Intro");
    expect(md).toContain("## Deep Dive");
    expect(md).toContain("Hello everyone.");
    expect(md).toContain("Now let's dive in.");
  });

  it("inserts periodic timestamp markers", () => {
    // Create segments spanning 3 minutes
    const segments = Array.from({ length: 36 }, (_, i) => ({
      text: `Word ${i}.`,
      offsetMs: i * 5000,
      durationMs: 5000,
    }));

    const md = assembleTranscriptMarkdown(segments, []);
    expect(md).toContain("[0:00]");
    expect(md).toContain("[1:00]");
    expect(md).toContain("[2:00]");
  });

  it("returns empty string for no segments", () => {
    expect(assembleTranscriptMarkdown([], [])).toBe("");
  });
});
