import { request } from "node:http";
import { existsSync } from "node:fs";
import { env } from "./env.js";
import { createTar, extractTar, type TarEntry } from "./tar.js";
import { logger } from "./logger.js";

// ── Types ────────────────────────────────────────────────

export interface SandboxFile {
  /** Filename (e.g. "data.xlsx", "report.csv"). Placed in /sandbox/input/ */
  name: string;
  data: Buffer;
}

export interface SandboxExecuteParams {
  language: string;
  code: string;
  stdin?: string;
  runTimeout?: number; // ms, default 30000
  /** Files to inject into /sandbox/input/ before execution */
  inputFiles?: SandboxFile[];
}

export interface SandboxResult {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  /** Files found in /sandbox/output/ after execution */
  outputFiles: SandboxFile[];
}

// ── Language configs ─────────────────────────────────────

interface LangConfig {
  image: string;
  /** Fallback image if the primary isn't available locally (won't be pulled) */
  fallbackImage?: string;
  cmd: (codePath: string) => string[];
  ext: string;
  version: string;
}

const LANGUAGES: Record<string, LangConfig> = {
  python:     { image: "nova-sandbox-python:latest", fallbackImage: "python:3.12-slim", cmd: (p) => ["python3", p],  ext: "py",  version: "3.12" },
  javascript: { image: "node:20-slim",       cmd: (p) => ["node", p],                                                 ext: "js",  version: "20" },
  typescript: { image: "node:22-slim",       cmd: (p) => ["node", "--experimental-strip-types", "--no-warnings", p],   ext: "ts",  version: "22" },
  bash:       { image: "bash:5.2",           cmd: (p) => ["bash", p],                                                 ext: "sh",  version: "5.2" },
  sh:         { image: "alpine:3.19",        cmd: (p) => ["sh", p],                                                   ext: "sh",  version: "3.19" },
};

// Aliases
LANGUAGES.py = LANGUAGES.python;
LANGUAGES.python3 = LANGUAGES.python;
LANGUAGES.js = LANGUAGES.javascript;
LANGUAGES.node = LANGUAGES.javascript;
LANGUAGES.ts = LANGUAGES.typescript;

// ── Docker Engine API helpers ────────────────────────────

function getSocketPath(): string {
  const host = env.SANDBOX_DOCKER_HOST ?? process.env.DOCKER_HOST ?? "";
  if (host.startsWith("unix://")) return host.slice(7);
  if (host.startsWith("/")) return host;

  // Check common socket locations
  const candidates = [
    "/var/run/docker.sock",
    `${process.env.HOME}/.colima/default/docker.sock`,
    `${process.env.HOME}/.docker/run/docker.sock`,
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "/var/run/docker.sock";
}

function dockerRequest(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 10_000,
): Promise<{ status: number; data: Buffer }> {
  const socketPath = getSocketPath();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Docker API timeout: ${method} ${path}`));
    }, timeoutMs);

    const req = request(
      {
        socketPath,
        method,
        path,
        headers: body ? { "Content-Type": "application/json" } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          clearTimeout(timer);
          resolve({ status: res.statusCode!, data: Buffer.concat(chunks) });
        });
      },
    );

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Send a raw Buffer body (for tar uploads via Docker archive API). */
function dockerRequestRaw(
  method: string,
  path: string,
  body: Buffer,
  contentType: string,
  timeoutMs = 10_000,
): Promise<{ status: number; data: Buffer }> {
  const socketPath = getSocketPath();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Docker API timeout: ${method} ${path}`));
    }, timeoutMs);

    const req = request(
      {
        socketPath,
        method,
        path,
        headers: {
          "Content-Type": contentType,
          "Content-Length": body.length,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          clearTimeout(timer);
          resolve({ status: res.statusCode!, data: Buffer.concat(chunks) });
        });
      },
    );

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

/**
 * Parse Docker multiplexed stream format.
 * Each frame: [stream_type(1)][padding(3)][size(4, big-endian)][payload(size)]
 */
function demuxDockerLogs(buf: Buffer): string {
  const parts: string[] = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    if (offset + 8 + size > buf.length) break;
    parts.push(buf.subarray(offset + 8, offset + 8 + size).toString("utf-8"));
    offset += 8 + size;
  }
  return parts.join("");
}

/** Ensure the Docker image is available locally, pulling if needed. */
async function ensureImage(image: string): Promise<void> {
  const encoded = encodeURIComponent(image);
  const inspect = await dockerRequest("GET", `/images/${encoded}/json`);
  if (inspect.status === 200) return;

  const pull = await dockerRequest(
    "POST",
    `/images/create?fromImage=${encoded}`,
    undefined,
    120_000,
  );
  if (pull.status !== 200) {
    throw new Error(`Failed to pull image ${image} (${pull.status}): ${pull.data.toString().slice(0, 300)}`);
  }
}

/** Copy files into a container using the Docker archive API (PUT /archive). */
async function copyFilesToContainer(
  containerId: string,
  destDir: string,
  files: SandboxFile[],
): Promise<void> {
  const tarEntries: TarEntry[] = files.map((f) => ({
    name: `${destDir.replace(/^\//, "")}/${f.name}`,
    data: f.data,
  }));
  const tar = createTar(tarEntries);

  const resp = await dockerRequestRaw(
    "PUT",
    `/containers/${containerId}/archive?path=/`,
    tar,
    "application/x-tar",
    30_000,
  );

  if (resp.status !== 200) {
    throw new Error(`Failed to copy files to container (${resp.status}): ${resp.data.toString().slice(0, 300)}`);
  }
}

/** Extract files from a container directory using the Docker archive API (GET /archive). */
async function copyFilesFromContainer(
  containerId: string,
  srcDir: string,
): Promise<SandboxFile[]> {
  const resp = await dockerRequest(
    "GET",
    `/containers/${containerId}/archive?path=${encodeURIComponent(srcDir)}`,
    undefined,
    30_000,
  );

  // 404 = directory doesn't exist (code didn't write any output files)
  if (resp.status === 404) return [];
  if (resp.status !== 200) return [];

  const entries = extractTar(resp.data);

  // Docker wraps in a directory — strip the top-level dir prefix
  return entries
    .filter((e) => e.data.length > 0)
    .map((e) => ({
      name: e.name.replace(/^[^/]+\//, ""), // strip "output/" prefix
      data: e.data,
    }))
    .filter((e) => e.name.length > 0);
}

// ── Main execution function ──────────────────────────────

const INPUT_DIR = "/sandbox/input";
const OUTPUT_DIR = "/sandbox/output";

export async function sandboxExecute(params: SandboxExecuteParams): Promise<SandboxResult> {
  const lang = LANGUAGES[params.language.toLowerCase()];
  if (!lang) {
    throw new Error(
      `Unsupported language: "${params.language}". Supported: python, javascript, typescript, bash, sh`,
    );
  }

  const timeout = params.runTimeout ?? 30_000;
  const codePath = `/tmp/code.${lang.ext}`;

  // Base64-encode code to avoid shell escaping issues
  const codeB64 = Buffer.from(params.code).toString("base64");

  // Build shell command: create dirs, decode code, execute
  const parts: string[] = [
    `mkdir -p ${INPUT_DIR} ${OUTPUT_DIR}`,
    `echo '${codeB64}' | base64 -d > ${codePath}`,
  ];

  if (params.stdin) {
    const stdinB64 = Buffer.from(params.stdin).toString("base64");
    parts.push(`echo '${stdinB64}' | base64 -d | ${lang.cmd(codePath).join(" ")}`);
  } else {
    parts.push(lang.cmd(codePath).join(" "));
  }

  const shellCmd = parts.join(" && ");

  // Try primary image (inspect only if there's a fallback — don't waste time pulling a local-only image)
  let resolvedImage = lang.image;
  if (lang.fallbackImage) {
    const encoded = encodeURIComponent(lang.image);
    const inspect = await dockerRequest("GET", `/images/${encoded}/json`);
    if (inspect.status === 200) {
      // Primary image exists locally — use it
    } else {
      // Primary image not built — fall back to slim image
      resolvedImage = lang.fallbackImage;
    }
  }
  await ensureImage(resolvedImage);

  // Create container
  const createResp = await dockerRequest("POST", "/containers/create", {
    Image: resolvedImage,
    Cmd: ["sh", "-c", shellCmd],
    NetworkDisabled: true,
    HostConfig: {
      Memory: 256 * 1024 * 1024,
      MemorySwap: 256 * 1024 * 1024,
      NanoCpus: 1_000_000_000,
      PidsLimit: 256,
      SecurityOpt: ["no-new-privileges"],
      AutoRemove: false,
    },
  });

  if (createResp.status !== 201) {
    throw new Error(
      `Docker container create failed (${createResp.status}): ${createResp.data.toString().slice(0, 500)}`,
    );
  }

  const { Id: containerId } = JSON.parse(createResp.data.toString());

  try {
    // Inject input files before starting the container
    if (params.inputFiles && params.inputFiles.length > 0) {
      await copyFilesToContainer(containerId, INPUT_DIR, params.inputFiles);
    }

    // Start container
    const startResp = await dockerRequest("POST", `/containers/${containerId}/start`);
    if (startResp.status !== 204 && startResp.status !== 304) {
      throw new Error(`Docker container start failed (${startResp.status})`);
    }

    // Wait for container to finish (with timeout)
    let exitCode = -1;
    let timedOut = false;

    try {
      const waitResp = await dockerRequest(
        "POST",
        `/containers/${containerId}/wait`,
        undefined,
        timeout + 5_000,
      );
      const waitResult = JSON.parse(waitResp.data.toString());
      exitCode = waitResult.StatusCode ?? -1;
    } catch {
      timedOut = true;
      await dockerRequest("POST", `/containers/${containerId}/kill`).catch((err) => logger.debug({ err, containerId }, "[sandbox] kill timed-out container failed"));
    }

    // Collect logs (stdout and stderr separately)
    const [stdoutResp, stderrResp] = await Promise.all([
      dockerRequest("GET", `/containers/${containerId}/logs?stdout=1&stderr=0`),
      dockerRequest("GET", `/containers/${containerId}/logs?stdout=0&stderr=1`),
    ]);

    const stdout = demuxDockerLogs(stdoutResp.data);
    let stderr = demuxDockerLogs(stderrResp.data);

    if (timedOut) {
      stderr = stderr
        ? `${stderr}\nExecution timed out after ${timeout}ms`
        : `Execution timed out after ${timeout}ms`;
      exitCode = 124;
    }

    // Extract output files
    const outputFiles = await copyFilesFromContainer(containerId, OUTPUT_DIR);

    return {
      language: params.language.toLowerCase(),
      version: lang.version,
      run: {
        stdout,
        stderr,
        code: exitCode,
        signal: timedOut ? "SIGKILL" : null,
        output: stdout + stderr,
      },
      outputFiles,
    };
  } finally {
    await dockerRequest("DELETE", `/containers/${containerId}?force=1`).catch((err) => logger.debug({ err, containerId }, "[sandbox] container cleanup failed"));
  }
}

export async function sandboxHealthCheck(): Promise<boolean> {
  try {
    const resp = await dockerRequest("GET", "/_ping", undefined, 3_000);
    return resp.status === 200;
  } catch {
    return false;
  }
}
