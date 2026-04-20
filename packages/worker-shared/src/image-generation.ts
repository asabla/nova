import { randomUUID } from "node:crypto";
import { resolveModelClient } from "./models.js";
import { putObjectBuffer } from "./s3.js";
import { env } from "./env.js";

export interface ImageGenerationParams {
  prompt: string;
  model?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
}

export interface GeneratedImage {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  revisedPrompt?: string;
}

const DEFAULT_MODEL = "gpt-image-1";

/**
 * Generate an image using the org's configured OpenAI-compatible provider.
 * Uploads the result to RustFS and returns the storage key.
 */
export async function generateImage(
  orgId: string,
  params: ImageGenerationParams,
): Promise<GeneratedImage> {
  const model = params.model ?? env.IMAGE_GENERATION_MODEL;

  const { client } = await resolveModelClient(orgId);

  const response = await client.images.generate({
    model,
    prompt: params.prompt,
    n: 1,
    size: params.size ?? "auto",
    quality: params.quality ?? "auto",
  } as any);

  const imageData = response.data?.[0];
  if (!imageData) {
    throw new Error("No image data returned from provider");
  }

  // Handle both b64_json and url responses
  let buffer: Buffer;
  if (imageData.b64_json) {
    buffer = Buffer.from(imageData.b64_json, "base64");
  } else if (imageData.url) {
    const res = await fetch(imageData.url);
    if (!res.ok) throw new Error(`Failed to download generated image: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    throw new Error("Image response contained neither b64_json nor url");
  }

  // Upload to RustFS
  const ext = "png";
  const mimeType = "image/png";
  const key = `${orgId}/generated-images/${randomUUID()}.${ext}`;
  await putObjectBuffer(key, buffer, mimeType);

  return {
    storageKey: key,
    mimeType,
    sizeBytes: buffer.length,
    revisedPrompt: imageData.revised_prompt ?? undefined,
  };
}
