import { S3Client, HeadBucketCommand, CreateBucketCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const endpoint = new URL(env.S3_ENDPOINT);

export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = env.S3_BUCKET;

// Rewrite internal S3 URLs to go through the nginx /storage/ proxy
// nginx forwards with the original Host header so the S3 signature stays valid
function toProxyUrl(url: string): string {
  if (!env.S3_PUBLIC_URL) return url;
  return url.replace(`${endpoint.protocol}//${endpoint.host}`, env.S3_PUBLIC_URL);
}

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

export async function getUploadUrl(orgId: string, filename: string): Promise<{ url: string; key: string }> {
  const key = `${orgId}/${crypto.randomUUID()}/${filename}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 60 * 15 });
  return { url: toProxyUrl(url), key };
}

export async function getDownloadUrl(key: string, contentType?: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(contentType && {
      ResponseContentType: contentType,
      ResponseContentDisposition: "inline",
    }),
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 60 * 60 });
  return toProxyUrl(url);
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
