import { Hono } from "hono";
import type { GatewayEnv } from "../app";
import { getObjectBuffer, putObjectBuffer } from "@nova/worker-shared/minio";

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
  const { minio } = await import("@nova/worker-shared/minio") as any;
  const bucket = process.env.MINIO_BUCKET ?? "nova-files";

  try {
    await minio.removeObject(bucket, key);
  } catch {
    // Ignore not-found on delete
  }

  return c.json({ ok: true });
});
