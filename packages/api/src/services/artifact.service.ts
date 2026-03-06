import { db } from "../lib/db";
import { artifacts } from "@nova/shared/schemas";
import { files } from "@nova/shared/schemas";
import { eq, and, isNull, desc } from "drizzle-orm";

interface CreateArtifactData {
  messageId: string;
  conversationId: string;
  type: string;
  title?: string;
  content?: string;
  fileId?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export async function createArtifact(orgId: string, data: CreateArtifactData) {
  const [artifact] = await db.insert(artifacts).values({
    orgId,
    messageId: data.messageId,
    conversationId: data.conversationId,
    type: data.type,
    title: data.title,
    content: data.content,
    fileId: data.fileId,
    language: data.language,
    metadata: data.metadata,
  }).returning();

  return artifact;
}

export async function listArtifacts(orgId: string, conversationId: string) {
  return db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.orgId, orgId),
        eq(artifacts.conversationId, conversationId),
        isNull(artifacts.deletedAt),
      ),
    )
    .orderBy(desc(artifacts.createdAt));
}

export async function getArtifact(orgId: string, artifactId: string) {
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(
      and(
        eq(artifacts.id, artifactId),
        eq(artifacts.orgId, orgId),
        isNull(artifacts.deletedAt),
      ),
    );

  return artifact ?? null;
}

export async function deleteArtifact(orgId: string, artifactId: string) {
  const [artifact] = await db
    .update(artifacts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(artifacts.id, artifactId),
        eq(artifacts.orgId, orgId),
        isNull(artifacts.deletedAt),
      ),
    )
    .returning();

  return artifact ?? null;
}

export async function saveToLibrary(orgId: string, artifactId: string, userId: string) {
  const artifact = await getArtifact(orgId, artifactId);
  if (!artifact) return null;

  const extension = getExtensionForType(artifact.type, artifact.language);
  const filename = `${artifact.title ?? "artifact"}${extension}`;
  const contentType = getContentTypeForType(artifact.type, artifact.language);

  const [file] = await db.insert(files).values({
    orgId,
    userId,
    filename,
    contentType,
    sizeBytes: Buffer.byteLength(artifact.content ?? "", "utf8"),
    storagePath: `artifacts/${orgId}/${artifactId}/${filename}`,
    storageBucket: "nova",
  }).returning();

  return file;
}

function getExtensionForType(type: string, language?: string | null): string {
  if (type === "code" && language) {
    const map: Record<string, string> = {
      python: ".py",
      javascript: ".js",
      typescript: ".ts",
      bash: ".sh",
      html: ".html",
      css: ".css",
      json: ".json",
      sql: ".sql",
      go: ".go",
      rust: ".rs",
      java: ".java",
      cpp: ".cpp",
      c: ".c",
      ruby: ".rb",
      php: ".php",
      swift: ".swift",
      kotlin: ".kt",
      yaml: ".yaml",
      xml: ".xml",
      markdown: ".md",
    };
    return map[language] ?? ".txt";
  }
  const typeMap: Record<string, string> = {
    html: ".html",
    mermaid: ".mmd",
    table: ".csv",
    chart: ".json",
    image: ".png",
  };
  return typeMap[type] ?? ".txt";
}

function getContentTypeForType(type: string, language?: string | null): string {
  if (type === "code") return "text/plain";
  const map: Record<string, string> = {
    html: "text/html",
    mermaid: "text/plain",
    table: "text/csv",
    chart: "application/json",
    image: "image/png",
  };
  return map[type] ?? "text/plain";
}
