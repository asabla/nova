import { getObjectBuffer } from "./s3";
import { extractFromHtml } from "@nova/shared/content";
import { decodeBuffer } from "@nova/shared/utils";
import { logger } from "./logger";

let _pdfParse: ((buf: Buffer) => Promise<{ text: string }>) | null = null;

async function getPdfParser(): Promise<(buf: Buffer) => Promise<{ text: string }>> {
  if (_pdfParse) return _pdfParse;
  // pdf-parse v1's index.js reads a test PDF when module.parent is undefined
  // (always true in Bun ESM). Use require on the inner lib to bypass that.
  // Lazy-load to avoid crashing at startup if the module path resolution differs.
  const { createRequire } = await import("node:module");
  try {
    const req = createRequire(import.meta.url);
    const resolved = req("pdf-parse/lib/pdf-parse.js");
    _pdfParse = typeof resolved === "function" ? resolved : (resolved?.default ?? resolved);
  } catch {
    try {
      const req = createRequire("/app/package.json");
      const resolved = req("pdf-parse/lib/pdf-parse.js");
      _pdfParse = typeof resolved === "function" ? resolved : (resolved?.default ?? resolved);
    } catch {
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
const TABULAR_INLINE_MAX_ROWS = 50;
const TABULAR_PREVIEW_ROWS = 10;

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "text/javascript",
  "text/typescript",
  "application/json",
  "application/xml",
  "text/xml",
]);

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TABULAR_MIMES = new Set([
  "text/csv",
  XLSX_MIME,
  "application/vnd.ms-excel",
]);

function inferColumnType(values: unknown[]): string {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (nonNull.length === 0) return "string";
  for (const v of nonNull) {
    if (typeof v === "boolean" || v === "true" || v === "false") return "boolean";
    if (typeof v === "number") return "number";
    if (v instanceof Date) return "date";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return "date";
  }
  return "string";
}

/**
 * Parse a tabular file (CSV/XLSX) and return either full content (small files)
 * or a structured preview with explicit instructions (large files).
 */
async function parseTabularPreview(buffer: Buffer, contentType: string, filename?: string): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = contentType === "text/csv" || filename?.toLowerCase().endsWith(".csv")
    ? XLSX.read(buffer.toString("utf-8"), { type: "string" })
    : XLSX.read(buffer, { type: "buffer" });

  let totalRows = 0;
  const sheetInfos: { name: string; rows: Record<string, unknown>[]; columns: string[] }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    sheetInfos.push({ name: sheetName, rows, columns });
    totalRows += rows.length;
  }

  // Small files: return full CSV text (existing behavior)
  if (totalRows <= TABULAR_INLINE_MAX_ROWS) {
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;
      if (workbook.SheetNames.length > 1) {
        parts.push(`## ${sheetName}\n`);
      }
      parts.push(XLSX.utils.sheet_to_csv(ws));
    }
    return parts.join("\n\n");
  }

  // Large files: return structured preview
  const lines: string[] = [];
  const format = contentType === "text/csv" ? "CSV" : "XLSX";
  lines.push(`Tabular data (${format}): ${totalRows} total rows across ${sheetInfos.length} sheet(s).`);
  lines.push("");

  for (const sheet of sheetInfos) {
    lines.push(`### Sheet "${sheet.name}" (${sheet.rows.length} rows, ${sheet.columns.length} columns)`);
    lines.push("");

    // Schema with types
    lines.push("**Columns:**");
    for (const col of sheet.columns) {
      const sampleValues = sheet.rows.slice(0, 10).map((r) => r[col]);
      const type = inferColumnType(sampleValues);
      lines.push(`- ${col} (${type})`);
    }
    lines.push("");

    // First N rows as CSV
    const previewRows = sheet.rows.slice(0, TABULAR_PREVIEW_ROWS);
    if (previewRows.length > 0) {
      lines.push(`**First ${previewRows.length} rows:**`);
      // Header
      lines.push(sheet.columns.join(","));
      for (const row of previewRows) {
        lines.push(sheet.columns.map((c) => {
          const v = row[c];
          if (v == null) return "";
          const s = String(v);
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","));
      }
    }
    lines.push("");
  }

  lines.push(`[TABULAR DATA PREVIEW: Showing first ${TABULAR_PREVIEW_ROWS} of ${totalRows} rows. The complete data is NOT in this message. To analyze the full dataset, use code_execute with pandas (pass the file ID via input_file_ids) or read_file. Do NOT answer data questions from this preview alone.]`);

  return lines.join("\n");
}

export async function extractFileContent(
  storagePath: string,
  contentType: string,
  filename?: string,
): Promise<string | null> {
  try {
    const buffer = await getObjectBuffer(storagePath);

    let text: string | null = null;

    if (TABULAR_MIMES.has(contentType)) {
      text = await parseTabularPreview(buffer, contentType, filename);
    } else if (contentType === "application/pdf") {
      text = await parsePdf(buffer);
    } else if (contentType === "text/html" || contentType === "application/xhtml+xml") {
      const html = decodeBuffer(buffer, { contentType, isHtml: true });
      const extracted = extractFromHtml(html);
      text = extracted.markdown;
    } else if (TEXT_MIME_TYPES.has(contentType)) {
      text = decodeBuffer(buffer, { contentType });
    }

    if (!text || text.trim().length === 0) return null;

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + `\n\n[... truncated, showing first ${MAX_CHARS} of ${text.length} characters]`;
    }

    return text.trim();
  } catch (err) {
    logger.warn({ err, storagePath }, "Failed to extract file content");
    return null;
  }
}
