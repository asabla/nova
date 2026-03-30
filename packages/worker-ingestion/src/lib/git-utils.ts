import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "@nova/worker-shared/logger";

const execFile = promisify(execFileCb);

/** Default directories/patterns to exclude from repo ingestion */
const DEFAULT_EXCLUDE_PATTERNS = [
  ".git",
  "node_modules",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "target",
  "bin",
  "obj",
  ".gradle",
  ".idea",
  ".vscode",
  ".DS_Store",
  "coverage",
  ".nyc_output",
  ".cache",
  ".parcel-cache",
  ".turbo",
];

/** File extensions to skip (binary/generated) */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".zip", ".tar", ".gz", ".bz2", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib", ".wasm",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".pptx",
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  ".lock", ".map",
  ".min.js", ".min.css",
  ".pyc", ".pyo", ".class",
]);

/** Max file size to process (500KB) */
const MAX_FILE_SIZE = 500 * 1024;

// ── Provider detection ──

export type GitProvider = "github" | "gitlab" | "bitbucket" | "git";

interface ParsedRepo {
  provider: GitProvider;
  owner: string;
  repo: string;
  apiBase: string;
}

/**
 * Parse a repo URL into provider, owner, and repo name.
 * Falls back to "git" provider if URL doesn't match known hosts.
 */
export function parseRepoUrl(url: string): ParsedRepo | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (pathParts.length < 2) return null;

    const owner = pathParts[0];
    const repo = pathParts[1];

    if (parsed.hostname === "github.com" || parsed.hostname === "www.github.com") {
      return { provider: "github", owner, repo, apiBase: "https://api.github.com" };
    }
    if (parsed.hostname === "gitlab.com" || parsed.hostname === "www.gitlab.com") {
      return { provider: "gitlab", owner, repo, apiBase: "https://gitlab.com/api/v4" };
    }
    if (parsed.hostname === "bitbucket.org" || parsed.hostname === "www.bitbucket.org") {
      return { provider: "bitbucket", owner, repo, apiBase: "https://api.bitbucket.org/2.0" };
    }
    // Self-hosted GitLab instances or other providers
    return null;
  } catch {
    return null;
  }
}

// ── Common types ──

export interface RepoFile {
  relativePath: string;
  content: string;
  sizeBytes: number;
  sha?: string;
}

export interface RepoTreeEntry {
  path: string;
  type: "file" | "dir";
  size?: number;
  sha?: string;
}

export interface ChangedFile {
  status: "added" | "modified" | "deleted" | "renamed";
  path: string;
  oldPath?: string;
}

// ── GitHub API ──

async function githubFetch(
  url: string,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Nova-Ingestion/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { headers });
}

async function githubGetTree(
  parsed: ParsedRepo,
  branch: string,
  token?: string,
): Promise<RepoTreeEntry[]> {
  // Get the branch ref first to get the tree SHA
  const refResp = await githubFetch(
    `${parsed.apiBase}/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${branch}`,
    token,
  );
  if (!refResp.ok) throw new Error(`GitHub: failed to get branch ref: ${refResp.status}`);
  const refData = (await refResp.json()) as { object: { sha: string } };

  // Get the full recursive tree
  const treeResp = await githubFetch(
    `${parsed.apiBase}/repos/${parsed.owner}/${parsed.repo}/git/trees/${refData.object.sha}?recursive=1`,
    token,
  );
  if (!treeResp.ok) throw new Error(`GitHub: failed to get tree: ${treeResp.status}`);
  const treeData = (await treeResp.json()) as {
    sha: string;
    tree: Array<{ path: string; type: string; size?: number; sha?: string }>;
    truncated: boolean;
  };

  return treeData.tree
    .filter((e) => e.type === "blob")
    .map((e) => ({
      path: e.path,
      type: "file" as const,
      size: e.size,
      sha: e.sha,
    }));
}

async function githubGetFileContent(
  parsed: ParsedRepo,
  path: string,
  branch: string,
  token?: string,
): Promise<string> {
  const resp = await githubFetch(
    `${parsed.apiBase}/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    token,
  );
  if (!resp.ok) throw new Error(`GitHub: failed to get file ${path}: ${resp.status}`);
  const data = (await resp.json()) as { content: string; encoding: string; size: number };

  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return data.content;
}

async function githubGetCommitSha(
  parsed: ParsedRepo,
  branch: string,
  token?: string,
): Promise<string> {
  const resp = await githubFetch(
    `${parsed.apiBase}/repos/${parsed.owner}/${parsed.repo}/commits/${branch}`,
    token,
  );
  if (!resp.ok) throw new Error(`GitHub: failed to get commit: ${resp.status}`);
  const data = (await resp.json()) as { sha: string };
  return data.sha;
}

async function githubCompareCommits(
  parsed: ParsedRepo,
  baseSha: string,
  headSha: string,
  token?: string,
): Promise<ChangedFile[]> {
  const resp = await githubFetch(
    `${parsed.apiBase}/repos/${parsed.owner}/${parsed.repo}/compare/${baseSha}...${headSha}`,
    token,
  );
  if (!resp.ok) {
    // If comparison fails (force-push), return null to trigger full re-index
    return [];
  }
  const data = (await resp.json()) as {
    files: Array<{
      filename: string;
      status: string;
      previous_filename?: string;
    }>;
  };

  return data.files.map((f) => {
    const statusMap: Record<string, ChangedFile["status"]> = {
      added: "added",
      modified: "modified",
      removed: "deleted",
      renamed: "renamed",
    };
    return {
      status: statusMap[f.status] ?? "modified",
      path: f.filename,
      oldPath: f.previous_filename,
    };
  });
}

// ── GitLab API ──

async function gitlabFetch(url: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["PRIVATE-TOKEN"] = token;
  return fetch(url, { headers });
}

async function gitlabGetTree(
  parsed: ParsedRepo,
  branch: string,
  token?: string,
): Promise<RepoTreeEntry[]> {
  const projectId = encodeURIComponent(`${parsed.owner}/${parsed.repo}`);
  const entries: RepoTreeEntry[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const resp = await gitlabFetch(
      `${parsed.apiBase}/projects/${projectId}/repository/tree?ref=${branch}&recursive=true&per_page=${perPage}&page=${page}`,
      token,
    );
    if (!resp.ok) throw new Error(`GitLab: failed to get tree: ${resp.status}`);
    const data = (await resp.json()) as Array<{ path: string; type: string; id?: string }>;

    entries.push(
      ...data
        .filter((e) => e.type === "blob")
        .map((e) => ({ path: e.path, type: "file" as const, sha: e.id })),
    );

    if (data.length < perPage) break;
    page++;
    if (page > 500) break; // Safety limit
  }

  return entries;
}

async function gitlabGetFileContent(
  parsed: ParsedRepo,
  path: string,
  branch: string,
  token?: string,
): Promise<string> {
  const projectId = encodeURIComponent(`${parsed.owner}/${parsed.repo}`);
  const resp = await gitlabFetch(
    `${parsed.apiBase}/projects/${projectId}/repository/files/${encodeURIComponent(path)}/raw?ref=${branch}`,
    token,
  );
  if (!resp.ok) throw new Error(`GitLab: failed to get file ${path}: ${resp.status}`);
  return resp.text();
}

async function gitlabGetCommitSha(
  parsed: ParsedRepo,
  branch: string,
  token?: string,
): Promise<string> {
  const projectId = encodeURIComponent(`${parsed.owner}/${parsed.repo}`);
  const resp = await gitlabFetch(
    `${parsed.apiBase}/projects/${projectId}/repository/branches/${encodeURIComponent(branch)}`,
    token,
  );
  if (!resp.ok) throw new Error(`GitLab: failed to get branch: ${resp.status}`);
  const data = (await resp.json()) as { commit: { id: string } };
  return data.commit.id;
}

async function gitlabCompareCommits(
  parsed: ParsedRepo,
  baseSha: string,
  headSha: string,
  token?: string,
): Promise<ChangedFile[]> {
  const projectId = encodeURIComponent(`${parsed.owner}/${parsed.repo}`);
  const resp = await gitlabFetch(
    `${parsed.apiBase}/projects/${projectId}/repository/compare?from=${baseSha}&to=${headSha}`,
    token,
  );
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    diffs: Array<{
      new_path: string;
      old_path: string;
      new_file: boolean;
      deleted_file: boolean;
      renamed_file: boolean;
    }>;
  };

  return data.diffs.map((d) => {
    if (d.deleted_file) return { status: "deleted" as const, path: d.old_path };
    if (d.new_file) return { status: "added" as const, path: d.new_path };
    if (d.renamed_file) return { status: "renamed" as const, path: d.new_path, oldPath: d.old_path };
    return { status: "modified" as const, path: d.new_path };
  });
}

// ── Unified provider interface ──

export interface RepoProvider {
  getTree(branch: string): Promise<RepoTreeEntry[]>;
  getFileContent(path: string, branch: string): Promise<string>;
  getHeadSha(branch: string): Promise<string>;
  getChangedFiles(baseSha: string, headSha: string): Promise<ChangedFile[]>;
}

/**
 * Create a provider-specific API client for a repository.
 * Returns null if the URL doesn't match any known provider (use git clone fallback).
 */
export function createRepoProvider(
  repoUrl: string,
  token?: string,
): RepoProvider | null {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return null;

  switch (parsed.provider) {
    case "github":
      return {
        getTree: (branch) => githubGetTree(parsed, branch, token),
        getFileContent: (path, branch) => githubGetFileContent(parsed, path, branch, token),
        getHeadSha: (branch) => githubGetCommitSha(parsed, branch, token),
        getChangedFiles: (base, head) => githubCompareCommits(parsed, base, head, token),
      };
    case "gitlab":
      return {
        getTree: (branch) => gitlabGetTree(parsed, branch, token),
        getFileContent: (path, branch) => gitlabGetFileContent(parsed, path, branch, token),
        getHeadSha: (branch) => gitlabGetCommitSha(parsed, branch, token),
        getChangedFiles: (base, head) => gitlabCompareCommits(parsed, base, head, token),
      };
    // Bitbucket can be added later with similar pattern
    default:
      return null;
  }
}

// ── File filtering (shared by API and clone paths) ──

function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
  const parts = relativePath.split("/");
  for (const part of parts) {
    if (DEFAULT_EXCLUDE_PATTERNS.includes(part)) return true;
    for (const pattern of excludePatterns) {
      if (matchGlob(part, pattern) || matchGlob(relativePath, pattern)) return true;
    }
  }
  return false;
}

function matchesInclude(relativePath: string, includeGlobs: string[]): boolean {
  if (includeGlobs.length === 0) return true;
  return includeGlobs.some((pattern) => matchGlob(relativePath, pattern));
}

function matchGlob(path: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${regex}$`).test(path);
}

function isBinaryExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of BINARY_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export interface FilterOptions {
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxFiles?: number;
}

/**
 * Filter a file tree to only processable code/text files.
 */
export function filterTree(
  entries: RepoTreeEntry[],
  options?: FilterOptions,
): RepoTreeEntry[] {
  const includeGlobs = options?.includeGlobs ?? [];
  const excludeGlobs = options?.excludeGlobs ?? [];
  const maxFiles = options?.maxFiles ?? 50_000;

  return entries
    .filter((e) => {
      if (e.type !== "file") return false;
      if (isBinaryExtension(e.path)) return false;
      if (shouldExclude(e.path, excludeGlobs)) return false;
      if (!matchesInclude(e.path, includeGlobs)) return false;
      if (e.size !== undefined && (e.size > MAX_FILE_SIZE || e.size === 0)) return false;
      return true;
    })
    .slice(0, maxFiles);
}

/**
 * Fetch file contents via provider API in batches.
 * Returns files with their content populated.
 */
export async function fetchFileContents(
  provider: RepoProvider,
  entries: RepoTreeEntry[],
  branch: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<RepoFile[]> {
  const files: RepoFile[] = [];
  const BATCH_SIZE = 10; // Concurrent API requests per batch

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const content = await provider.getFileContent(entry.path, branch);
        // Skip binary content (null bytes)
        if (content.includes("\0")) return null;
        return {
          relativePath: entry.path,
          content,
          sizeBytes: entry.size ?? Buffer.byteLength(content),
          sha: entry.sha,
        };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        files.push(result.value);
      }
    }

    onProgress?.(Math.min(i + BATCH_SIZE, entries.length), entries.length);
  }

  return files;
}

// ── Git clone fallback (for generic git:// URLs without known API) ──

export async function cloneRepo(
  repoUrl: string,
  options?: { branch?: string; token?: string; depth?: number },
): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "nova-repo-"));
  const args = ["clone", "--depth", String(options?.depth ?? 1), "--single-branch"];

  if (options?.branch) args.push("--branch", options.branch);

  let authUrl = repoUrl;
  if (options?.token) {
    const url = new URL(repoUrl);
    url.username = "x-access-token";
    url.password = options.token;
    authUrl = url.toString();
  }

  args.push(authUrl, tempDir);

  await execFile("git", args, {
    timeout: 120_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });

  return tempDir;
}

export async function getCloneHeadSha(repoPath: string): Promise<string> {
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], { cwd: repoPath });
  return stdout.trim();
}

export async function walkClonedRepo(
  repoPath: string,
  options?: FilterOptions,
): Promise<RepoFile[]> {
  const includeGlobs = options?.includeGlobs ?? [];
  const excludeGlobs = options?.excludeGlobs ?? [];
  const maxFiles = options?.maxFiles ?? 50_000;

  const { stdout } = await execFile("git", ["ls-files", "--cached"], {
    cwd: repoPath,
    maxBuffer: 50 * 1024 * 1024,
  });

  const filePaths = stdout.trim().split("\n").filter(Boolean);
  const files: RepoFile[] = [];

  for (const relativePath of filePaths) {
    if (files.length >= maxFiles) break;
    if (shouldExclude(relativePath, excludeGlobs)) continue;
    if (!matchesInclude(relativePath, includeGlobs)) continue;
    if (isBinaryExtension(relativePath)) continue;

    const fullPath = join(repoPath, relativePath);
    try {
      const stats = await stat(fullPath);
      if (!stats.isFile() || stats.size > MAX_FILE_SIZE || stats.size === 0) continue;
      const content = await readFile(fullPath, "utf-8");
      if (content.includes("\0")) continue;
      files.push({ relativePath, content, sizeBytes: stats.size });
    } catch {
      // Skip unreadable files
    }
  }

  return files;
}

export async function cleanupClone(repoPath: string): Promise<void> {
  try {
    await rm(repoPath, { recursive: true, force: true });
  } catch (err: unknown) {
    logger.warn({ err, repoPath }, "[git] Failed to cleanup clone");
  }
}

// ── Validation ──

export async function validateRepoAccess(
  repoUrl: string,
  token?: string,
): Promise<{ valid: boolean; error?: string; defaultBranch?: string }> {
  // Try provider API first (no disk I/O)
  const provider = createRepoProvider(repoUrl, token);
  if (provider) {
    try {
      await provider.getHeadSha("main");
      return { valid: true, defaultBranch: "main" };
    } catch {
      try {
        await provider.getHeadSha("master");
        return { valid: true, defaultBranch: "master" };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("401") || message.includes("403")) {
          return { valid: false, error: "Authentication failed — check your access token" };
        }
        if (message.includes("404")) {
          return { valid: false, error: "Repository not found" };
        }
        return { valid: false, error: `Failed to access repository: ${message}` };
      }
    }
  }

  // Fallback: git ls-remote (requires git on disk, but no full clone)
  let authUrl = repoUrl;
  if (token) {
    try {
      const url = new URL(repoUrl);
      url.username = "x-access-token";
      url.password = token;
      authUrl = url.toString();
    } catch {
      return { valid: false, error: "Invalid repository URL" };
    }
  }

  try {
    const { stdout } = await execFile("git", ["ls-remote", "--symref", authUrl, "HEAD"], {
      timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    const branchMatch = stdout.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    return { valid: true, defaultBranch: branchMatch?.[1] ?? "main" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Authentication") || message.includes("403") || message.includes("401")) {
      return { valid: false, error: "Authentication failed — check your access token" };
    }
    if (message.includes("not found") || message.includes("404")) {
      return { valid: false, error: "Repository not found" };
    }
    return { valid: false, error: `Failed to access repository: ${message}` };
  }
}
