import { describe, it, expect } from "bun:test";
import {
  formatFileContext,
  shouldInlineFile,
  decodeFileBuffer,
  type ConversationFileRef,
} from "../../src/tools/builtin";

const csvFile: ConversationFileRef = {
  fileId: "f-csv",
  filename: "data.csv",
  contentType: "text/csv",
  sizeBytes: 2048,
  storagePath: "org/data.csv",
};

const xlsxFile: ConversationFileRef = {
  fileId: "f-xlsx",
  filename: "report.xlsx",
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  sizeBytes: 10_240,
  storagePath: "org/report.xlsx",
};

const pdfFile: ConversationFileRef = {
  fileId: "f-pdf",
  filename: "paper.pdf",
  contentType: "application/pdf",
  sizeBytes: 500_000,
  storagePath: "org/paper.pdf",
};

const jsonFile: ConversationFileRef = {
  fileId: "f-json",
  filename: "config.json",
  contentType: "application/json",
  sizeBytes: 512,
  storagePath: "org/config.json",
};

describe("formatFileContext", () => {
  it("returns empty string for no files", () => {
    expect(formatFileContext([], new Map())).toBe("");
  });

  it("emits manifest header and line for a single file without inline content", () => {
    const out = formatFileContext([csvFile], new Map());
    expect(out).toContain("## Files available in this conversation");
    expect(out).toContain(`- "data.csv" (id: f-csv, type: text/csv, 2.0 KB) [TABULAR]`);
    expect(out).not.toContain("## File contents");
  });

  it("adds [TABULAR] marker for CSV/XLSX but not for JSON", () => {
    const out = formatFileContext([csvFile, xlsxFile, jsonFile], new Map());
    expect(out).toMatch(/data\.csv.*\[TABULAR\]/);
    expect(out).toMatch(/report\.xlsx.*\[TABULAR\]/);
    expect(out).not.toMatch(/config\.json.*\[TABULAR\]/);
  });

  it("inlines content for files present in the contents map", () => {
    const contents = new Map([["f-csv", "name,age\nalice,30"]]);
    const out = formatFileContext([csvFile], contents);
    expect(out).toContain("## File contents");
    expect(out).toContain("--- File: data.csv (id: f-csv) ---");
    expect(out).toContain("name,age\nalice,30");
    expect(out).toContain("--- End of file ---");
  });

  it("truncates content longer than 8000 chars and appends marker", () => {
    const big = "Z".repeat(9000);
    const contents = new Map([["f-csv", big]]);
    const out = formatFileContext([csvFile], contents);
    expect(out).toContain("... (truncated)");
    // The inlined content section should cap at 8000 'Z' chars plus the truncation marker
    const zCount = (out.match(/Z/g) ?? []).length;
    expect(zCount).toBe(8000);
  });

  it("does not append truncation marker when content is exactly at the limit", () => {
    const exact = "Z".repeat(8000);
    const contents = new Map([["f-csv", exact]]);
    const out = formatFileContext([csvFile], contents);
    expect(out).not.toContain("... (truncated)");
  });

  it("skips inline for files not in the contents map (e.g. RAG-indexed PDFs)", () => {
    const out = formatFileContext([pdfFile], new Map());
    expect(out).toContain("paper.pdf");
    expect(out).not.toContain("## File contents");
  });

  it("mixes inlined and non-inlined files cleanly", () => {
    const contents = new Map([["f-csv", "a,b\n1,2"]]);
    const out = formatFileContext([csvFile, pdfFile], contents);
    expect(out).toContain("data.csv");
    expect(out).toContain("paper.pdf");
    expect(out).toContain("## File contents");
    expect(out).toContain("a,b\n1,2");
    expect(out).not.toContain("paper.pdf ---\n"); // pdf content not inlined
  });

  it("formats size with one decimal place", () => {
    const file: ConversationFileRef = { ...csvFile, sizeBytes: 1536 };
    const out = formatFileContext([file], new Map());
    expect(out).toContain("1.5 KB");
  });

  it("handles null sizeBytes as 0.0 KB", () => {
    const file: ConversationFileRef = { ...csvFile, sizeBytes: null };
    const out = formatFileContext([file], new Map());
    expect(out).toContain("0.0 KB");
  });
});

describe("shouldInlineFile", () => {
  it("returns false when storagePath is missing", () => {
    expect(shouldInlineFile({ contentType: "text/csv", storagePath: null })).toBe(false);
  });

  it("returns false for RAG-indexed PDFs", () => {
    expect(shouldInlineFile({ contentType: "application/pdf", storagePath: "x" })).toBe(false);
  });

  it("returns false for RAG-indexed PPTX", () => {
    expect(
      shouldInlineFile({
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        storagePath: "x",
      }),
    ).toBe(false);
  });

  it("returns true for CSV, XLSX, JSON, text", () => {
    expect(shouldInlineFile({ contentType: "text/csv", storagePath: "x" })).toBe(true);
    expect(
      shouldInlineFile({
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        storagePath: "x",
      }),
    ).toBe(true);
    expect(shouldInlineFile({ contentType: "application/json", storagePath: "x" })).toBe(true);
    expect(shouldInlineFile({ contentType: "text/plain", storagePath: "x" })).toBe(true);
  });
});

describe("decodeFileBuffer", () => {
  it("decodes text/csv as utf-8", async () => {
    const buf = Buffer.from("name,age\nbob,25", "utf-8");
    const result = await decodeFileBuffer(buf, "text/csv", "data.csv");
    expect(result).toBe("name,age\nbob,25");
  });

  it("decodes text/plain as utf-8", async () => {
    const buf = Buffer.from("hello world", "utf-8");
    const result = await decodeFileBuffer(buf, "text/plain", "note.txt");
    expect(result).toBe("hello world");
  });

  it("decodes application/json as utf-8", async () => {
    const buf = Buffer.from(`{"a":1}`, "utf-8");
    const result = await decodeFileBuffer(buf, "application/json", "config.json");
    expect(result).toBe(`{"a":1}`);
  });

  it("decodes application/xml as utf-8", async () => {
    const buf = Buffer.from("<root/>", "utf-8");
    const result = await decodeFileBuffer(buf, "application/xml", "feed.xml");
    expect(result).toBe("<root/>");
  });

  it("returns null for binary types (images, zip, etc.)", async () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff]);
    expect(await decodeFileBuffer(buf, "image/jpeg", "pic.jpg")).toBeNull();
    expect(await decodeFileBuffer(buf, "application/zip", "archive.zip")).toBeNull();
  });

  it("falls back on .csv extension when contentType is missing", async () => {
    const buf = Buffer.from("a,b\n1,2", "utf-8");
    const result = await decodeFileBuffer(buf, "", "data.csv");
    expect(result).toBe("a,b\n1,2");
  });
});
