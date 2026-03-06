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

export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) {
    await minio.makeBucket(BUCKET);
  }
}

export async function getUploadUrl(orgId: string, filename: string): Promise<{ url: string; key: string }> {
  const key = `${orgId}/${crypto.randomUUID()}/${filename}`;
  const url = await minio.presignedPutObject(BUCKET, key, 60 * 15);
  return { url, key };
}

export async function getDownloadUrl(key: string): Promise<string> {
  return minio.presignedGetObject(BUCKET, key, 60 * 60);
}

export async function deleteObject(key: string): Promise<void> {
  await minio.removeObject(BUCKET, key);
}
