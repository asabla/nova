import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TASK_QUEUES } from "@nova/shared/constants";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { researchReports, researchReportVersions, orgSettings, models } from "@nova/shared/schemas";
import { getTemporalClient } from "../lib/temporal";
import { AppError } from "@nova/shared/utils";
import { relayResearchToSSE } from "../lib/stream-relay";

const researchRoutes = new Hono<AppContext>();

// --- Helper functions for export formats (Story #80) ---

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Simple markdown → HTML converter (no external deps needed) */
function markdownToHtml(md: string): string {
  let html = md;
  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold/italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  // Clean up
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-3]>)/g, "$1");
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");
  return html;
}

/** Generate a minimal valid DOCX file (Office Open XML) without external libraries */
function generateMinimalDocx(title: string, markdownContent: string): Uint8Array {
  // A DOCX is a ZIP containing XML files. We use the simplest possible structure.
  // For a production system, consider using a library like docx or officegen.
  // This generates a valid DOCX that Word/LibreOffice can open.

  // Convert markdown to plain-ish text with paragraph breaks for Word
  const paragraphs = markdownContent.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    // Detect headings
    const h1 = trimmed.match(/^# (.+)/);
    if (h1) return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(h1[1])}</w:t></w:r></w:p>`;

    const h2 = trimmed.match(/^## (.+)/);
    if (h2) return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(h2[1])}</w:t></w:r></w:p>`;

    const h3 = trimmed.match(/^### (.+)/);
    if (h3) return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>${escapeXml(h3[1])}</w:t></w:r></w:p>`;

    // Strip markdown formatting for plain text
    const plain = trimmed
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(plain)}</w:t></w:r></w:p>`;
  }).filter(Boolean);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${paragraphs.join("\n")}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  // Build a minimal ZIP file manually (STORE method, no compression)
  return buildZip([
    { name: "[Content_Types].xml", data: new TextEncoder().encode(contentTypesXml) },
    { name: "_rels/.rels", data: new TextEncoder().encode(relsXml) },
    { name: "word/_rels/document.xml.rels", data: new TextEncoder().encode(wordRelsXml) },
    { name: "word/document.xml", data: new TextEncoder().encode(documentXml) },
  ]);
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Build a minimal valid ZIP file from entries (STORE method) */
function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    // Local file header (30 + nameLen)
    const header = new Uint8Array(30 + nameBytes.length);
    const hView = new DataView(header.buffer);
    hView.setUint32(0, 0x04034b50, true); // signature
    hView.setUint16(4, 20, true); // version needed
    hView.setUint16(6, 0, true); // flags
    hView.setUint16(8, 0, true); // compression (STORE)
    hView.setUint16(10, 0, true); // mod time
    hView.setUint16(12, 0, true); // mod date
    // CRC-32 (compute simple)
    const crc = crc32(entry.data);
    hView.setUint32(14, crc, true);
    hView.setUint32(18, entry.data.length, true); // compressed size
    hView.setUint32(22, entry.data.length, true); // uncompressed size
    hView.setUint16(26, nameBytes.length, true);
    hView.setUint16(28, 0, true); // extra field length
    header.set(nameBytes, 30);

    // Central directory entry
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdEntry.buffer);
    cdView.setUint32(0, 0x02014b50, true); // signature
    cdView.setUint16(4, 20, true); // version made by
    cdView.setUint16(6, 20, true); // version needed
    cdView.setUint16(8, 0, true); // flags
    cdView.setUint16(10, 0, true); // compression
    cdView.setUint16(12, 0, true); // mod time
    cdView.setUint16(14, 0, true); // mod date
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, entry.data.length, true);
    cdView.setUint32(24, entry.data.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true); // extra field length
    cdView.setUint16(32, 0, true); // comment length
    cdView.setUint16(34, 0, true); // disk number
    cdView.setUint16(36, 0, true); // internal attrs
    cdView.setUint32(38, 0, true); // external attrs
    cdView.setUint32(42, offset, true); // offset of local header
    cdEntry.set(nameBytes, 46);

    parts.push(header, entry.data);
    centralDir.push(cdEntry);
    offset += header.length + entry.data.length;
  }

  // End of central directory
  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);
  parts.push(eocd);

  // Concatenate all parts
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

/** Simple CRC-32 implementation */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Resolve the org's default model external ID (e.g. "gpt-5.4") */
async function resolveDefaultModel(orgId: string): Promise<string> {
  const [setting] = await db.select().from(orgSettings).where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "defaultModel")));
  if (setting?.value) return setting.value;
  // Fallback: first enabled default model in the org
  const [m] = await db.select({ modelIdExternal: models.modelIdExternal }).from(models).where(and(eq(models.orgId, orgId), eq(models.isDefault, true), eq(models.isEnabled, true))).limit(1);
  return m?.modelIdExternal ?? "gpt-5.4";
}

researchRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const result = await db.select().from(researchReports)
    .where(eq(researchReports.orgId, orgId))
    .orderBy(desc(researchReports.createdAt))
    .limit(50);

  return c.json({ data: result });
});

researchRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const [report] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!report) throw AppError.notFound("Research report not found");
  return c.json(report);
});

// SSE stream for real-time research progress
researchRoutes.get("/:id/stream", async (c) => {
  const orgId = c.get("orgId");
  const [report] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!report) throw AppError.notFound("Research report not found");

  // If already terminal, return current status as a single event
  if (report.status === "completed" || report.status === "failed") {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: report.status === "completed" ? "research.done" : "research.error",
        data: JSON.stringify(
          report.status === "completed"
            ? { reportId: report.id, sourcesCount: (report.sources as unknown[])?.length ?? 0 }
            : { message: (report.config as any)?.error ?? "Research failed" },
        ),
      });
    });
  }

  const channelId = `research:${report.id}`;

  return streamSSE(c, async (stream) => {
    // Send current status as first event
    await stream.writeSSE({
      event: "research.status",
      data: JSON.stringify({ status: report.status }),
    });

    await relayResearchToSSE(stream, channelId);
  });
});

const startResearchSchema = z.object({
  query: z.string().min(3).max(2000),
  conversationId: z.string().uuid().optional(),
  maxSources: z.number().int().min(1).max(50).optional().default(10),
  maxIterations: z.number().int().min(1).max(10).optional().default(3),
  sources: z.object({
    webSearch: z.boolean().optional().default(true),
    knowledgeCollectionIds: z.array(z.string().uuid()).optional().default([]),
    fileIds: z.array(z.string().uuid()).optional().default([]),
  }).optional().default({ webSearch: true, knowledgeCollectionIds: [], fileIds: [] }),
});

researchRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = startResearchSchema.parse(await c.req.json());

  const workflowId = crypto.randomUUID();
  const [report] = await db.insert(researchReports).values({
    orgId,
    conversationId: body.conversationId ?? crypto.randomUUID(),
    userId,
    workflowId,
    query: body.query,
    status: "pending",
    config: { maxSources: body.maxSources, maxIterations: body.maxIterations, sources: body.sources },
  }).returning();

  // Start Temporal workflow (dispatched to agent worker)
  try {
    const client = await getTemporalClient();
    const resolvedModel = await resolveDefaultModel(orgId);
    const hasKnowledge = body.sources.knowledgeCollectionIds.length > 0;
    const hasFiles = body.sources.fileIds.length > 0;
    const maxTurns = Math.max(20, body.maxSources * 2 + (hasKnowledge ? 10 : 0) + (hasFiles ? 5 : 0));
    await client.workflow.start("agentWorkflow", {
      taskQueue: TASK_QUEUES.AGENT,
      workflowId: `research-${report.id}`,
      args: [{
        orgId,
        userId,
        conversationId: report.conversationId,
        streamChannelId: `research:${report.id}`,
        model: resolvedModel,
        userMessage: body.query,
        messageHistory: [],
        maxSteps: maxTurns,
        timeoutSeconds: 1800,
        researchConfig: {
          reportId: report.id,
          query: body.query,
          maxSources: body.maxSources,
          sources: body.sources,
        },
      }],
    });
  } catch {
    // If Temporal is unavailable, mark as failed
    await db.update(researchReports).set({ status: "failed" }).where(eq(researchReports.id, report.id));
  }

  return c.json(report, 201);
});

// Rename research report title
const patchResearchSchema = z.object({
  title: z.string().min(1).max(200),
});

researchRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const body = patchResearchSchema.parse(await c.req.json());
  const [report] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!report) throw AppError.notFound("Research report not found");

  const [updated] = await db.update(researchReports).set({
    title: body.title,
    updatedAt: new Date(),
  }).where(eq(researchReports.id, report.id)).returning();

  return c.json(updated);
});

// Export research report
researchRoutes.get("/:id/export", async (c) => {
  const orgId = c.get("orgId");
  const format = c.req.query("format") ?? "markdown";
  const [report] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!report) throw AppError.notFound("Research report not found");

  if (format === "json") {
    c.header("Content-Disposition", `attachment; filename="research-${report.id}.json"`);
    return c.json(report);
  }

  // Build markdown content (reused by md, html, pdf, docx formats)
  const md = [
    `# ${report.query}`,
    "",
    `*Generated: ${new Date(report.createdAt).toISOString()}*`,
    "",
    report.reportContent ?? "*No report content available*",
    "",
    "## Sources",
    "",
    ...((report.sources as any[]) ?? []).map((s: any, i: number) =>
      `${i + 1}. [${s.title ?? s.url}](${s.url})${s.summary ? ` - ${s.summary}` : ""}`
    ),
  ].join("\n");

  if (format === "markdown") {
    c.header("Content-Type", "text/markdown");
    c.header("Content-Disposition", `attachment; filename="research-${report.id}.md"`);
    return c.body(md);
  }

  // Convert markdown to simple HTML for html/pdf/docx formats
  const htmlContent = markdownToHtml(md);

  if (format === "html" || format === "pdf") {
    // For PDF: we provide a print-ready HTML page. The client can print to PDF
    // or a server-side headless browser can convert this to PDF.
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(report.query)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
  h2 { color: #374151; margin-top: 2em; }
  a { color: #2563eb; }
  blockquote { border-left: 4px solid #d1d5db; margin: 1em 0; padding: 0.5em 1em; color: #4b5563; }
  code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  ol, ul { padding-left: 1.5em; }
  @media print { body { margin: 20px; } @page { margin: 2cm; } }
</style>
</head>
<body>
${htmlContent}
<footer style="margin-top: 3em; padding-top: 1em; border-top: 1px solid #e5e7eb; font-size: 0.85em; color: #6b7280;">
  Generated by NOVA Research &middot; ${new Date(report.createdAt).toLocaleDateString()}
</footer>
</body>
</html>`;

    c.header("Content-Type", "text/html");
    c.header("Content-Disposition", `attachment; filename="research-${report.id}.html"`);
    return c.body(fullHtml);
  }

  if (format === "docx") {
    // Generate a minimal DOCX using the Office Open XML format.
    // This creates a valid .docx file without requiring external libraries.
    const docxContent = generateMinimalDocx(report.query, md);
    return new Response(docxContent.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="research-${report.id}.docx"`,
      },
    });
  }

  // Fallback: markdown
  c.header("Content-Type", "text/markdown");
  c.header("Content-Disposition", `attachment; filename="research-${report.id}.md"`);
  return c.body(md);
});

// Re-run research with different parameters
researchRoutes.post("/:id/rerun", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const [originalReport] = await db.select().from(researchReports)
    .where(and(eq(researchReports.id, c.req.param("id")), eq(researchReports.orgId, orgId)));

  if (!originalReport) throw AppError.notFound("Research report not found");

  const body = z.object({
    maxSources: z.number().int().min(1).max(50).optional(),
    maxIterations: z.number().int().min(1).max(10).optional(),
    sources: z.object({
      webSearch: z.boolean().optional(),
      knowledgeCollectionIds: z.array(z.string().uuid()).optional(),
      fileIds: z.array(z.string().uuid()).optional(),
    }).optional(),
  }).parse(await c.req.json());

  const config = (originalReport.config as Record<string, any>) ?? {};
  const resolvedSources = {
    webSearch: body.sources?.webSearch ?? config.sources?.webSearch ?? true,
    knowledgeCollectionIds: body.sources?.knowledgeCollectionIds ?? config.sources?.knowledgeCollectionIds ?? [],
    fileIds: body.sources?.fileIds ?? config.sources?.fileIds ?? [],
  };
  const workflowId = crypto.randomUUID();
  const [newReport] = await db.insert(researchReports).values({
    orgId,
    conversationId: originalReport.conversationId,
    userId,
    workflowId,
    query: originalReport.query,
    status: "pending",
    config: {
      maxSources: body.maxSources ?? config.maxSources ?? 10,
      maxIterations: body.maxIterations ?? config.maxIterations ?? 3,
      sources: resolvedSources,
    },
  }).returning();

  try {
    const maxSources = body.maxSources ?? config.maxSources ?? 10;
    const rerunHasKnowledge = resolvedSources.knowledgeCollectionIds.length > 0;
    const rerunHasFiles = resolvedSources.fileIds.length > 0;
    const maxTurns = Math.max(20, maxSources * 2 + (rerunHasKnowledge ? 10 : 0) + (rerunHasFiles ? 5 : 0));
    const resolvedModel = await resolveDefaultModel(orgId);
    const client = await getTemporalClient();
    await client.workflow.start("agentWorkflow", {
      taskQueue: TASK_QUEUES.AGENT,
      workflowId: `research-${newReport.id}`,
      args: [{
        orgId,
        userId,
        conversationId: originalReport.conversationId,
        streamChannelId: `research:${newReport.id}`,
        model: resolvedModel,
        userMessage: originalReport.query,
        messageHistory: [],
        maxSteps: maxTurns,
        timeoutSeconds: 1800,
        researchConfig: {
          reportId: newReport.id,
          query: originalReport.query,
          maxSources,
          sources: resolvedSources,
        },
      }],
    });
  } catch {
    await db.update(researchReports).set({ status: "failed" }).where(eq(researchReports.id, newReport.id));
  }

  return c.json(newReport, 201);
});

// --- Research report versions ---

researchRoutes.get("/:id/versions", async (c) => {
  const orgId = c.get("orgId");
  const reportId = c.req.param("id");

  const [report] = await db
    .select({ id: researchReports.id })
    .from(researchReports)
    .where(and(eq(researchReports.id, reportId), eq(researchReports.orgId, orgId)))
    .limit(1);

  if (!report) throw AppError.notFound("Research report");

  const versions = await db
    .select()
    .from(researchReportVersions)
    .where(eq(researchReportVersions.reportId, reportId))
    .orderBy(desc(researchReportVersions.version));

  return c.json({ data: versions });
});

researchRoutes.get("/:id/versions/:version", async (c) => {
  const orgId = c.get("orgId");
  const reportId = c.req.param("id");
  const version = parseInt(c.req.param("version"), 10);

  const [report] = await db
    .select({ id: researchReports.id })
    .from(researchReports)
    .where(and(eq(researchReports.id, reportId), eq(researchReports.orgId, orgId)))
    .limit(1);

  if (!report) throw AppError.notFound("Research report");

  const [reportVersion] = await db
    .select()
    .from(researchReportVersions)
    .where(
      and(
        eq(researchReportVersions.reportId, reportId),
        eq(researchReportVersions.version, version),
      ),
    )
    .limit(1);

  if (!reportVersion) throw AppError.notFound("Report version");

  return c.json(reportVersion);
});

// --- Research refinement ---

researchRoutes.post("/:id/refine", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const reportId = c.req.param("id");
  const body = await c.req.json();

  const refinementPrompt = z.string().min(1).max(2000).parse(body.refinementPrompt);

  // Get the existing report
  const [report] = await db
    .select()
    .from(researchReports)
    .where(and(eq(researchReports.id, reportId), eq(researchReports.orgId, orgId)))
    .limit(1);

  if (!report) throw AppError.notFound("Research report");
  if (report.status !== "completed") throw AppError.badRequest("Can only refine completed reports");

  const newVersion = (report.currentVersion ?? 1) + 1;

  // Create version entry
  const [versionEntry] = await db.insert(researchReportVersions).values({
    reportId,
    version: newVersion,
    refinementPrompt,
    parentVersionId: null, // Could track previous version ID
    status: "running",
  }).returning();

  // Update report's current version
  await db.update(researchReports).set({
    currentVersion: newVersion,
    status: "running",
    updatedAt: new Date(),
  }).where(eq(researchReports.id, reportId));

  // Start refinement workflow (dispatched to agent worker)
  try {
    const client = await getTemporalClient();
    const resolvedModel = await resolveDefaultModel(orgId);
    const streamChannelId = `research:${reportId}:v${newVersion}`;
    const reportConfig = (report.config as Record<string, any>) ?? {};

    await client.workflow.start("agentWorkflow", {
      taskQueue: TASK_QUEUES.AGENT,
      workflowId: `research-refine-${reportId}-v${newVersion}`,
      args: [{
        orgId,
        userId,
        conversationId: report.conversationId,
        streamChannelId,
        model: resolvedModel,
        userMessage: refinementPrompt,
        messageHistory: [],
        maxSteps: 25,
        timeoutSeconds: 900,
        researchConfig: {
          reportId,
          query: report.query,
          maxSources: reportConfig.maxSources ?? 10,
          sources: reportConfig.sources ?? { webSearch: true, knowledgeCollectionIds: [], fileIds: [] },
          refinement: {
            previousContent: report.reportContent ?? "",
            previousSources: (report.sources as any[]) ?? [],
            prompt: refinementPrompt,
            versionId: versionEntry.id,
          },
        },
      }],
    });

    return c.json({
      versionId: versionEntry.id,
      version: newVersion,
      streamChannelId,
    }, 201);
  } catch {
    await db.update(researchReportVersions)
      .set({ status: "failed" })
      .where(eq(researchReportVersions.id, versionEntry.id));

    await db.update(researchReports).set({
      currentVersion: report.currentVersion,
      status: "completed",
    }).where(eq(researchReports.id, reportId));

    throw AppError.badRequest("Failed to start refinement workflow");
  }
});

export { researchRoutes };
