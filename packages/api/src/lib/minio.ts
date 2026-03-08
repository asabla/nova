import { Client as MinioClient } from "minio";
import { env } from "./env";

const endpoint = new URL(env.MINIO_ENDPOINT);

export const minio = new MinioClient({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || (endpoint.protocol === "https:" ? 443 : 9000),
  useSSL: endpoint.protocol === "https:",
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
});

const BUCKET = env.MINIO_BUCKET;

// Rewrite minio:9000 URLs to go through the nginx /storage/ proxy
// nginx forwards with Host: minio:9000 so the S3 signature stays valid
function toProxyUrl(url: string): string {
  if (!env.MINIO_PUBLIC_URL) return url;
  return url.replace(`${endpoint.protocol}//${endpoint.host}`, env.MINIO_PUBLIC_URL);
}

export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) {
    await minio.makeBucket(BUCKET);
  }
}

export async function getUploadUrl(orgId: string, filename: string): Promise<{ url: string; key: string }> {
  const key = `${orgId}/${crypto.randomUUID()}/${filename}`;
  const url = await minio.presignedPutObject(BUCKET, key, 60 * 15);
  return { url: toProxyUrl(url), key };
}

export async function getDownloadUrl(key: string): Promise<string> {
  const url = await minio.presignedGetObject(BUCKET, key, 60 * 60);
  return toProxyUrl(url);
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const stream = await minio.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  await minio.removeObject(BUCKET, key);
}
