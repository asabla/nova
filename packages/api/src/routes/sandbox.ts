import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { sandboxExecutions } from "@nova/shared/schemas";
import { auditService } from "../services/audit.service";
import { requireRole } from "../middleware/rbac";

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

  // Create execution record
  const [execution] = await db.insert(sandboxExecutions).values({
    orgId,
    userId,
    language: body.language,
    code: body.code,
    status: "running",
    timeoutSeconds: body.timeout,
    memoryLimitMb: body.memoryMb,
  }).returning();

  await auditService.writeAuditLog({
    orgId,
    userId,
    action: "sandbox.execute",
    resourceType: "sandbox_execution",
    resourceId: execution.id,
    metadata: { language: body.language },
  });

  // In production, this would call nsjail/gVisor/Firecracker
  // For MVP, execute in a subprocess with timeout
  try {
    const result = await executeInSandbox(body.language, body.code, body.timeout);

    await db.update(sandboxExecutions).set({
      status: "completed",
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      executionTimeMs: result.durationMs,
      updatedAt: new Date(),
    }).where(({ id: col }) => col.equals(execution.id));

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
      status: "failed",
      error: err.message,
      updatedAt: new Date(),
    }).where(({ id: col }) => col.equals(execution.id));

    return c.json({
      id: execution.id,
      status: "failed",
      error: err.message,
    }, 500);
  }
});

sandboxRoutes.get("/:id", async (c) => {
  const [execution] = await db.select().from(sandboxExecutions)
    .where(({ id: col }) => col.equals(c.req.param("id")));

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
