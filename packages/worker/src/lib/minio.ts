import { Client as MinioClient } from "minio";
import { env } from "./env";

const endpoint = new URL(env.MINIO_ENDPOINT);

export const minio = new MinioClient({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || 9000,
  useSSL: endpoint.protocol === "https:",
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
});

const BUCKET = env.MINIO_BUCKET;

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const stream = await minio.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function putObjectBuffer(
  key: string,
  data: Buffer,
  contentType?: string,
): Promise<void> {
  await minio.putObject(BUCKET, key, data, data.length, contentType ? { "Content-Type": contentType } : undefined);
}
