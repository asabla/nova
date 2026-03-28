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
  /** Programming language (e.g. "typescript", "python") — set for code file chunks */
  language?: string;
  /** Symbol name (e.g. "validateSession") — set when chunk represents a single symbol */
  symbolName?: string;
  /** Symbol kind (e.g. "function", "class", "type") — set when chunk represents a single symbol */
  symbolKind?: string;
  /** File path relative to repository root — set for repo-ingested files */
  filePath?: string;
  /** Whether the symbol is exported from its module */
  isExported?: boolean;
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
