import { getObjectBuffer } from "./minio";
import { extractFromHtml } from "@nova/shared/content";

let _pdfParse: ((buf: Buffer) => Promise<{ text: string }>) | null = null;

async function getPdfParser(): Promise<(buf: Buffer) => Promise<{ text: string }>> {
  if (_pdfParse) return _pdfParse;
  // pdf-parse v1's index.js reads a test PDF when module.parent is undefined
  // (always true in Bun ESM). Use require on the inner lib to bypass that.
  // Lazy-load to avoid crashing at startup if the module path resolution differs.
  const { createRequire } = await import("node:module");
  try {
    const req = createRequire(import.meta.url);
    _pdfParse = req("pdf-parse/lib/pdf-parse.js");
  } catch {
    // Fallback: try absolute path
    try {
      const req = createRequire("/app/package.json");
      _pdfParse = req("pdf-parse/lib/pdf-parse.js");
    } catch {
      // Last resort: dynamic import of the main module (may fail with test file read)
      const mod: any = await import("pdf-parse");
      _pdfParse = (mod.default ?? mod) as any;
    }
  }
  return _pdfParse!;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = await getPdfParser();
  const result = await pdfParse(buffer);
  return result.text;
}

const MAX_CHARS = 60_000; // ~15k tokens, keeps context manageable

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/javascript",
  "text/typescript",
  "application/json",
  "application/xml",
  "text/xml",
]);

export async function extractFileContent(
  storagePath: string,
  contentType: string,
): Promise<string | null> {
  try {
    const buffer = await getObjectBuffer(storagePath);

    let text: string | null = null;

    if (contentType === "application/pdf") {
      text = await parsePdf(buffer);
    } else if (contentType === "text/html" || contentType === "application/xhtml+xml") {
      const html = buffer.toString("utf-8");
      const extracted = extractFromHtml(html);
      text = extracted.markdown;
    } else if (TEXT_MIME_TYPES.has(contentType)) {
      text = buffer.toString("utf-8");
    }

    if (!text || text.trim().length === 0) return null;

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + `\n\n[... truncated, showing first ${MAX_CHARS} of ${text.length} characters]`;
    }

    return text.trim();
  } catch (err) {
    console.warn("Failed to extract file content:", storagePath, err);
    return null;
  }
}
