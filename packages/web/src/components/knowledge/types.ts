export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceUrl?: string;
  fileId?: string;
  status: "pending" | "indexing" | "ready" | "error";
  errorMessage?: string;
  tokenCount?: number;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  knowledgeDocumentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  status: string;
  embeddingModelId?: string;
  embeddingModel?: string;
  chunkSize: number;
  chunkOverlap: number;
  version: number;
  lastIndexedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface HistoryEntry {
  id: string;
  action: string;
  actorId: string | null;
  actorType: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
