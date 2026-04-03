import { Hono } from "hono";
import type { GatewayEnv } from "../app";
import { getObjectBuffer, putObjectBuffer } from "@nova/worker-shared/s3";

export const storageRoutes = new Hono<GatewayEnv>();

storageRoutes.get("/objects/:key{.+}", async (c) => {
  const key = c.req.param("key");

  try {
    const buffer = await getObjectBuffer(key);
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (err: any) {
    if (err?.code === "NoSuchKey" || err?.code === "NotFound") {
      return c.json({ error: "Not found" }, 404);
    }
    throw err;
  }
});

storageRoutes.put("/objects/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const contentType = c.req.header("Content-Type") ?? "application/octet-stream";

  const body = await c.req.arrayBuffer();
  await putObjectBuffer(key, Buffer.from(body), contentType);

  return c.json({ ok: true, key });
});

storageRoutes.delete("/objects/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.S3_BUCKET ?? "nova-files";

  const s3 = new S3Client({
    region: "us-east-1",
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // Ignore not-found on delete
  }

  return c.json({ ok: true });
});
