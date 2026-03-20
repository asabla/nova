import { describe, it, expect, beforeAll } from "bun:test";

// Set minimal env vars before importing (env.ts validates on import)
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://nova:nova@localhost:5432/nova";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.SANDBOX_ENABLED = "true";

import { sandboxExecute, sandboxHealthCheck } from "../../src/lib/docker-sandbox";

// These tests require Docker to be running locally.

describe("docker-sandbox", () => {
  beforeAll(async () => {
    const healthy = await sandboxHealthCheck();
    if (!healthy) {
      throw new Error("Docker is not available — skipping sandbox tests");
    }
  });

  it("should pass health check", async () => {
    const healthy = await sandboxHealthCheck();
    expect(healthy).toBe(true);
  });

  it("should execute Python code", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: 'print("hello from sandbox")',
      runTimeout: 30_000,
    });

    expect(result.language).toBe("python");
    expect(result.run.stdout.trim()).toBe("hello from sandbox");
    expect(result.run.code).toBe(0);
    expect(result.outputFiles).toEqual([]);
  });

  it("should execute Bash code", async () => {
    const result = await sandboxExecute({
      language: "bash",
      code: 'echo "hello bash"',
      runTimeout: 30_000,
    });

    expect(result.run.stdout.trim()).toBe("hello bash");
    expect(result.run.code).toBe(0);
  });

  it("should capture stderr", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: 'import sys; print("error!", file=sys.stderr)',
      runTimeout: 30_000,
    });

    expect(result.run.stderr).toContain("error!");
    expect(result.run.code).toBe(0);
  });

  it("should return non-zero exit code on error", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: 'raise ValueError("boom")',
      runTimeout: 30_000,
    });

    expect(result.run.code).not.toBe(0);
    expect(result.run.stderr).toContain("ValueError");
  });

  it("should handle stdin", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: 'name = input(); print(f"hello {name}")',
      stdin: "world",
      runTimeout: 30_000,
    });

    expect(result.run.stdout.trim()).toBe("hello world");
  });

  it("should inject input files and extract output files", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: [
        "import os",
        "# Read input file",
        'with open("/sandbox/input/data.txt") as f:',
        "    content = f.read()",
        "# Write output file",
        'os.makedirs("/sandbox/output", exist_ok=True)',
        'with open("/sandbox/output/result.txt", "w") as f:',
        '    f.write(f"processed: {content}")',
        'print("done")',
      ].join("\n"),
      runTimeout: 30_000,
      inputFiles: [{ name: "data.txt", data: Buffer.from("hello world") }],
    });

    expect(result.run.stdout.trim()).toBe("done");
    expect(result.run.code).toBe(0);
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0].name).toBe("result.txt");
    expect(result.outputFiles[0].data.toString()).toBe("processed: hello world");
  });

  it("should reject unsupported languages", async () => {
    await expect(
      sandboxExecute({ language: "cobol", code: "hello", runTimeout: 5000 }),
    ).rejects.toThrow("Unsupported language");
  });

  it("should enforce timeout", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: "import time; time.sleep(60)",
      runTimeout: 3_000,
    });

    expect(result.run.code).toBe(124);
    expect(result.run.stderr).toContain("timed out");
  }, 15_000);

  it("should block network access", async () => {
    const result = await sandboxExecute({
      language: "python",
      code: [
        "import urllib.request",
        "try:",
        '    urllib.request.urlopen("https://example.com", timeout=3)',
        '    print("NETWORK_OK")',
        "except Exception as e:",
        '    print(f"NETWORK_BLOCKED: {e}")',
      ].join("\n"),
      runTimeout: 10_000,
    });

    expect(result.run.stdout).not.toContain("NETWORK_OK");
    expect(result.run.stdout).toContain("NETWORK_BLOCKED");
  }, 20_000);
});
