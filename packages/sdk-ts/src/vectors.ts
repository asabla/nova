import type { NovaClient } from "./client";

export interface VectorPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export class NovaVectors {
  constructor(private client: NovaClient) {}

  async search(
    collection: string,
    query: number[],
    opts?: { filter?: Record<string, unknown>; limit?: number; scoreThreshold?: number },
  ): Promise<VectorSearchResult[]> {
    return this.client.post("/vectors/search", { collection, query, ...opts });
  }

  async upsert(collection: string, points: VectorPoint[]) {
    return this.client.post("/vectors/upsert", { collection, points });
  }

  async delete(collection: string, filter: Record<string, unknown>) {
    return this.client.post("/vectors/delete", { collection, filter });
  }

  async scrollText(
    collection: string,
    field: string,
    query: string,
    opts?: { filter?: Record<string, unknown>; limit?: number },
  ) {
    return this.client.post("/vectors/scroll-text", { collection, field, query, ...opts });
  }

  async scrollFiltered(collection: string, filter: Record<string, unknown>, limit?: number) {
    return this.client.post("/vectors/scroll-filtered", { collection, filter, limit });
  }
}
