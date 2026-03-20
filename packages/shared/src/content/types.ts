export interface ExtractedContent {
  title: string | null;
  byline: string | null;
  publishedDate: string | null;
  description: string | null;
  language: string | null;
  siteName: string | null;
  markdown: string;
  textContent: string;
  wordCount: number;
  sourceUrl?: string;
}

export interface ChunkMetadata {
  sourceUrl?: string;
  documentTitle?: string;
  headingHierarchy: string[];
  sectionHeading?: string;
  positionRatio: number;
  chunkType: "text" | "code" | "table" | "mixed" | "image";
}

export interface ContentChunk {
  text: string;
  index: number;
  metadata: ChunkMetadata;
}

export interface ChunkOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  preserveTables?: boolean;
}
