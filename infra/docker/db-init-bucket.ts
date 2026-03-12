import { Client } from "minio";

const endpoint = new URL(process.env.MINIO_ENDPOINT!);
const client = new Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || 9000,
  useSSL: endpoint.protocol === "https:",
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

const bucket = process.env.MINIO_BUCKET ?? "nova-files";
const exists = await client.bucketExists(bucket);
if (!exists) {
  await client.makeBucket(bucket);
  console.log("  Created bucket:", bucket);
} else {
  console.log("  Bucket already exists:", bucket);
}
