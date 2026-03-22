import { randomUUID } from "node:crypto";
import { sandboxExecute, type SandboxFile } from "@nova/worker-shared/sandbox";
import { getObjectBuffer, putObjectBuffer } from "@nova/worker-shared/minio";
import { env } from "@nova/worker-shared/env";
import { db } from "@nova/worker-shared/db";
import { sandboxExecutions } from "@nova/shared/schemas";

export interface SandboxOutputFile {
  name: string;
  storageKey: string;
  sizeBytes: number;
}

export async function executeSandboxCode(params: {
  orgId: string;
  language: string;
  code: string;
  stdin?: string;
  timeoutMs?: number;
  toolCallId?: string;
  messageId?: string;
  /** MinIO storage keys for files to inject into /sandbox/input/ */
  inputFileKeys?: { name: string; storageKey: string }[];
}): Promise<{
  executionId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: string | null;
  durationMs: number;
  language: string;
  version: string;
  outputFiles: SandboxOutputFile[];
}> {
  if (!env.SANDBOX_ENABLED) {
    throw new Error("Sandbox execution is disabled (SANDBOX_ENABLED=false)");
  }

  const timeoutMs = Math.min(params.timeoutMs ?? 30_000, 300_000);

  // Download input files from MinIO
  let inputFiles: SandboxFile[] | undefined;
  if (params.inputFileKeys && params.inputFileKeys.length > 0) {
    inputFiles = await Promise.all(
      params.inputFileKeys.map(async (f) => ({
        name: f.name,
        data: await getObjectBuffer(f.storageKey),
      })),
    );
  }

  const startTime = Date.now();

  const result = await sandboxExecute({
    language: params.language,
    code: params.code,
    stdin: params.stdin,
    runTimeout: timeoutMs,
    inputFiles,
  });

  const durationMs = Date.now() - startTime;
  const executionId = randomUUID();

  // Upload output files to MinIO
  const outputFiles: SandboxOutputFile[] = [];
  for (const file of result.outputFiles) {
    const storageKey = `${params.orgId}/sandbox/${executionId}/${file.name}`;
    await putObjectBuffer(storageKey, file.data);
    outputFiles.push({
      name: file.name,
      storageKey,
      sizeBytes: file.data.length,
    });
  }

  // Record execution in database
  try {
    await db.insert(sandboxExecutions).values({
      id: executionId,
      orgId: params.orgId,
      toolCallId: params.toolCallId ? params.toolCallId as any : undefined,
      messageId: params.messageId ? params.messageId as any : undefined,
      language: result.language,
      code: params.code,
      stdout: result.run.stdout.slice(0, 100_000),
      stderr: result.run.stderr.slice(0, 10_000),
      exitCode: result.run.code,
      durationMs,
      sandboxBackend: "docker",
    });
  } catch (err) {
    console.error("[sandbox] Failed to record execution:", err);
  }

  return {
    executionId,
    stdout: result.run.stdout.slice(0, 100_000),
    stderr: result.run.stderr.slice(0, 10_000),
    exitCode: result.run.code,
    signal: result.run.signal,
    durationMs,
    language: result.language,
    version: result.version,
    outputFiles,
  };
}
