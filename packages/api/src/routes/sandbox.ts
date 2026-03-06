import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { sandboxExecutions } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";

const sandboxRoutes = new Hono<AppContext>();

const executeSchema = z.object({
  language: z.enum(["python", "javascript", "typescript", "bash"]),
  code: z.string().min(1).max(100_000),
  timeout: z.number().int().min(1).max(300).optional().default(30),
  memoryMb: z.number().int().min(64).max(2048).optional().default(256),
});

sandboxRoutes.post("/execute", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = executeSchema.parse(await c.req.json());

  const [execution] = await db.insert(sandboxExecutions).values({
    orgId,
    language: body.language,
    code: body.code,
    sandboxBackend: "process",
  }).returning();

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "sandbox.execute",
    resourceType: "sandbox_execution",
    resourceId: execution.id,
    details: { language: body.language },
  });

  try {
    const result = await executeInSandbox(body.language, body.code, body.timeout);

    await db.update(sandboxExecutions).set({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      updatedAt: new Date(),
    }).where(eq(sandboxExecutions.id, execution.id));

    return c.json({
      id: execution.id,
      status: "completed",
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    await db.update(sandboxExecutions).set({
      stderr: err.message,
      exitCode: 1,
      updatedAt: new Date(),
    }).where(eq(sandboxExecutions.id, execution.id));

    return c.json({
      id: execution.id,
      status: "failed",
      error: err.message,
    }, 500);
  }
});

sandboxRoutes.get("/:id", async (c) => {
  const [execution] = await db.select().from(sandboxExecutions)
    .where(eq(sandboxExecutions.id, c.req.param("id")));

  if (!execution) return c.json({ error: "Execution not found" }, 404);
  return c.json(execution);
});

async function executeInSandbox(language: string, code: string, timeoutSec: number): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}> {
  const start = Date.now();
  const commands: Record<string, string[]> = {
    python: ["python3", "-c", code],
    javascript: ["node", "-e", code],
    typescript: ["npx", "tsx", "-e", code],
    bash: ["bash", "-c", code],
  };

  const cmd = commands[language];
  if (!cmd) throw new Error(`Unsupported language: ${language}`);

  const proc = Bun.spawn(cmd, {
    timeout: timeoutSec * 1000,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return {
    stdout: stdout.slice(0, 100_000),
    stderr: stderr.slice(0, 10_000),
    exitCode,
    durationMs: Date.now() - start,
  };
}

export { sandboxRoutes };
