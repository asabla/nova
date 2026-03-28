import { createRequire } from "node:module";
import type { ContentChunk, ChunkMetadata, ChunkOptions } from "@nova/shared/content";

// ── Types ──

export interface TranscriptSegment {
  text: string;
  offsetMs: number;
  durationMs: number;
}

export interface YouTubeChapter {
  title: string;
  startMs: number;
}

export interface YouTubeVideoMeta {
  videoId: string;
  title: string;
  channelName: string;
  description: string;
  thumbnailUrl: string;
  chapters: YouTubeChapter[];
}

// ── URL Helpers ──

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url);
}

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

// ── Chapter Parsing ──

/**
 * Parse chapter markers from a YouTube video description.
 * YouTube requires the first timestamp to be 0:00 for chapters to be recognized.
 */
export function parseChapters(description: string): YouTubeChapter[] {
  const regex = /(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)/g;
  const chapters: YouTubeChapter[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(description)) !== null) {
    const timeStr = match[1];
    const title = match[2].trim();
    const ms = parseTimestampToMs(timeStr);
    chapters.push({ title, startMs: ms });
  }

  // YouTube only recognizes chapters if the first one starts at 0:00
  if (chapters.length > 0 && chapters[0].startMs !== 0) {
    return [];
  }

  return chapters;
}

function parseTimestampToMs(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return (parts[0] * 60 + parts[1]) * 1000;
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ── Transcript Fetching ──

/**
 * Fetch transcript segments for a YouTube video.
 * Returns empty array if no captions are available.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  try {
    // Use createRequire to load the CJS build — the package has "type": "module"
    // but "main" points to CJS, which breaks with Node's ESM import().
    const require = createRequire(import.meta.url);
    const ytModule = require("youtube-transcript");
    const fetchFn = ytModule.fetchTranscript;
    const raw = await fetchFn(videoId);
    return raw.map((r: any) => ({
      text: r.text,
      offsetMs: r.offset,
      durationMs: r.duration,
    }));
  } catch (err: any) {
    // Distinguish between "no captions" and actual errors
    const msg = err?.message ?? "";
    if (
      msg.includes("Transcript is disabled") ||
      msg.includes("No transcripts are available")
    ) {
      return [];
    }
    throw err;
  }
}

// ── Metadata Fetching ──

/**
 * Fetch video metadata by scraping the YouTube page for OG tags.
 * If YOUTUBE_API_KEY is set, uses the Data API v3 instead.
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeVideoMeta> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey) {
    return fetchMetadataViaApi(videoId, apiKey);
  }
  return fetchMetadataViaPage(videoId);
}

async function fetchMetadataViaApi(videoId: string, apiKey: string): Promise<YouTubeVideoMeta> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    console.warn(`[YouTube] Data API returned ${res.status}, falling back to page scraping`);
    return fetchMetadataViaPage(videoId);
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    throw new Error(`YouTube video not found: ${videoId}`);
  }

  const snippet = item.snippet;
  const description = snippet.description ?? "";

  return {
    videoId,
    title: snippet.title ?? "Untitled",
    channelName: snippet.channelTitle ?? "",
    description,
    thumbnailUrl: snippet.thumbnails?.maxres?.url ?? snippet.thumbnails?.high?.url ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    chapters: parseChapters(description),
  };
}

async function fetchMetadataViaPage(videoId: string): Promise<YouTubeVideoMeta> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; NovaBot/1.0)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube page (HTTP ${res.status})`);
  }

  // Read enough HTML for OG tags and description
  const html = await res.text();

  const title = extractMetaContent(html, "og:title") ?? extractHtmlTitle(html) ?? "Untitled";
  const channelName = extractMetaContent(html, "og:site_name") ?? "YouTube";
  const thumbnailUrl = extractMetaContent(html, "og:image") ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  // Try to extract description from meta or from page data
  const description = extractMetaContent(html, "og:description") ?? "";

  // Parse chapters from description (limited from OG description, but try)
  // For full chapter support, YOUTUBE_API_KEY is recommended
  const chapters = parseChapters(description);

  return { videoId, title, channelName, description, thumbnailUrl, chapters };
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

// ── Transcript Chunking ──

interface TranscriptChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
}

const CHUNK_DEFAULTS = { maxChunkSize: 1500, overlap: 150 };

/**
 * Chunk transcript segments into ContentChunks with timestamp metadata.
 * Uses chapter boundaries when available, otherwise groups by size.
 */
export function chunkTranscriptWithTimestamps(
  segments: TranscriptSegment[],
  chapters: YouTubeChapter[],
  videoId: string,
  opts?: TranscriptChunkOptions,
): ContentChunk[] {
  const { maxChunkSize, overlap } = { ...CHUNK_DEFAULTS, ...opts };

  if (segments.length === 0) return [];

  if (chapters.length >= 1) {
    return chunkByChapters(segments, chapters, videoId, maxChunkSize);
  }

  return chunkBySize(segments, videoId, maxChunkSize);
}

function makeTimestampUrl(videoId: string, ms: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(ms / 1000)}`;
}

function makeChunkMeta(
  videoId: string,
  startMs: number,
  endMs: number,
  chapterTitle?: string,
  positionRatio: number = 0,
): ChunkMetadata {
  return {
    headingHierarchy: chapterTitle ? [chapterTitle] : [],
    sectionHeading: chapterTitle,
    positionRatio,
    chunkType: "transcript",
    startTimeMs: startMs,
    endTimeMs: endMs,
    timestampUrl: makeTimestampUrl(videoId, startMs),
    chapterTitle,
  };
}

/**
 * Chunk transcript using chapter boundaries. Each chapter becomes one or more chunks.
 */
function chunkByChapters(
  segments: TranscriptSegment[],
  chapters: YouTubeChapter[],
  videoId: string,
  maxChunkSize: number,
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;
  const totalChapters = chapters.length;

  for (let ci = 0; ci < totalChapters; ci++) {
    const chapterStart = chapters[ci].startMs;
    const chapterEnd = ci + 1 < totalChapters ? chapters[ci + 1].startMs : Infinity;
    const chapterTitle = chapters[ci].title;

    // Collect segments that fall within this chapter
    const chapterSegments = segments.filter(
      (s) => s.offsetMs >= chapterStart && s.offsetMs < chapterEnd,
    );

    if (chapterSegments.length === 0) continue;

    // Group segments into sub-chunks if the chapter text exceeds maxChunkSize
    const subChunks = groupSegments(chapterSegments, maxChunkSize);

    for (const group of subChunks) {
      const text = group.map((s) => s.text).join(" ");
      const startMs = group[0].offsetMs;
      const last = group[group.length - 1];
      const endMs = last.offsetMs + last.durationMs;

      chunks.push({
        text,
        index: chunkIndex++,
        metadata: makeChunkMeta(
          videoId,
          startMs,
          endMs,
          chapterTitle,
          ci / totalChapters,
        ),
      });
    }
  }

  return chunks;
}

/**
 * Chunk transcript by accumulating segments up to maxChunkSize.
 */
function chunkBySize(
  segments: TranscriptSegment[],
  videoId: string,
  maxChunkSize: number,
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;
  const totalDuration = segments.length > 0
    ? segments[segments.length - 1].offsetMs + segments[segments.length - 1].durationMs
    : 1;

  const groups = groupSegments(segments, maxChunkSize);

  for (const group of groups) {
    const text = group.map((s) => s.text).join(" ");
    const startMs = group[0].offsetMs;
    const last = group[group.length - 1];
    const endMs = last.offsetMs + last.durationMs;

    chunks.push({
      text,
      index: chunkIndex++,
      metadata: makeChunkMeta(
        videoId,
        startMs,
        endMs,
        undefined,
        startMs / totalDuration,
      ),
    });
  }

  return chunks;
}

/**
 * Group transcript segments into batches that don't exceed maxChunkSize characters.
 * Tries not to break mid-sentence.
 */
function groupSegments(
  segments: TranscriptSegment[],
  maxChunkSize: number,
): TranscriptSegment[][] {
  const groups: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let currentLen = 0;

  for (const seg of segments) {
    const segLen = seg.text.length + 1; // +1 for joining space

    if (currentLen + segLen > maxChunkSize && current.length > 0) {
      groups.push(current);
      current = [];
      currentLen = 0;
    }

    current.push(seg);
    currentLen += segLen;
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

// ── Markdown Assembly ──

/**
 * Assemble transcript segments into a markdown document with chapter headings
 * and periodic timestamp markers. Used for the document's stored `content` field
 * and for LLM enrichment/summarization.
 */
export function assembleTranscriptMarkdown(
  segments: TranscriptSegment[],
  chapters: YouTubeChapter[],
): string {
  if (segments.length === 0) return "";

  const lines: string[] = [];
  let chapterIdx = 0;
  let lastTimestampMs = -60_000; // force first timestamp marker

  for (const seg of segments) {
    // Insert chapter heading when we cross a chapter boundary
    while (
      chapterIdx < chapters.length &&
      seg.offsetMs >= chapters[chapterIdx].startMs
    ) {
      if (lines.length > 0) lines.push(""); // blank line before heading
      lines.push(`## ${chapters[chapterIdx].title}`);
      lines.push("");
      chapterIdx++;
    }

    // Insert timestamp marker roughly every 60 seconds
    if (seg.offsetMs - lastTimestampMs >= 60_000) {
      lines.push(`[${formatMs(seg.offsetMs)}]`);
      lastTimestampMs = seg.offsetMs;
    }

    lines.push(seg.text);
  }

  return lines.join("\n");
}
