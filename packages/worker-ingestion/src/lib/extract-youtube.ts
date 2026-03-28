/**
 * YouTube transcript extraction for knowledge base ingestion.
 *
 * Core utilities (URL detection, transcript fetching, metadata, markdown assembly)
 * live in @nova/worker-shared/youtube. This module re-exports them and adds
 * the chunking logic that produces ContentChunk[] for the ingestion pipeline.
 */
export {
  isYouTubeUrl,
  extractYouTubeVideoId,
  parseChapters,
  formatMs,
  makeTimestampUrl,
  fetchYouTubeTranscript,
  fetchYouTubeMetadata,
  assembleTranscriptMarkdown,
  type TranscriptSegment,
  type YouTubeChapter,
  type YouTubeVideoMeta,
} from "@nova/worker-shared/youtube";

import type { TranscriptSegment, YouTubeChapter } from "@nova/worker-shared/youtube";
import { makeTimestampUrl } from "@nova/worker-shared/youtube";
import type { ContentChunk, ChunkMetadata } from "@nova/shared/content";

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
  const { maxChunkSize } = { ...CHUNK_DEFAULTS, ...opts };

  if (segments.length === 0) return [];

  if (chapters.length >= 1) {
    return chunkByChapters(segments, chapters, videoId, maxChunkSize);
  }

  return chunkBySize(segments, videoId, maxChunkSize);
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

    const chapterSegments = segments.filter(
      (s) => s.offsetMs >= chapterStart && s.offsetMs < chapterEnd,
    );

    if (chapterSegments.length === 0) continue;

    const subChunks = groupSegments(chapterSegments, maxChunkSize);

    for (const group of subChunks) {
      const text = group.map((s) => s.text).join(" ");
      const startMs = group[0].offsetMs;
      const last = group[group.length - 1];
      const endMs = last.offsetMs + last.durationMs;

      chunks.push({
        text,
        index: chunkIndex++,
        metadata: makeChunkMeta(videoId, startMs, endMs, chapterTitle, ci / totalChapters),
      });
    }
  }

  return chunks;
}

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
      metadata: makeChunkMeta(videoId, startMs, endMs, undefined, startMs / totalDuration),
    });
  }

  return chunks;
}

function groupSegments(
  segments: TranscriptSegment[],
  maxChunkSize: number,
): TranscriptSegment[][] {
  const groups: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let currentLen = 0;

  for (const seg of segments) {
    const segLen = seg.text.length + 1;

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
