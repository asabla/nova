import type { NovaClient } from "./client";

export class NovaStorage {
  constructor(private client: NovaClient) {}

  /** Download an object as a Buffer. */
  async getObject(key: string): Promise<ArrayBuffer> {
    const response = await this.client.fetch(`/storage/objects/${encodeURIComponent(key)}`);
    return response.arrayBuffer();
  }

  /** Upload an object. */
  async putObject(key: string, data: ArrayBuffer | Uint8Array, contentType?: string) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const blob = new Blob([bytes as BlobPart], { type: contentType ?? "application/octet-stream" });
    await this.client.fetch(`/storage/objects/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
      },
      body: blob,
    });
  }

  /** Delete an object. */
  async deleteObject(key: string) {
    await this.client.fetch(`/storage/objects/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  }
}
