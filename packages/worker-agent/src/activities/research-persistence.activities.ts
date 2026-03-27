import { eq } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { researchReports, researchReportVersions } from "@nova/shared/schemas";
import type { ResearchSource, ReportSection } from "@nova/worker-shared/tools";
import type { ResearchStatus, ResearchProgressType } from "@nova/shared/constants";
import {
  publishResearchStatus,
  publishResearchDone,
  publishResearchError,
  publishResearchProgress,
} from "@nova/worker-shared/stream";

/**
 * Persist the final research result to the database.
 */
export async function persistResearchResult(
  reportId: string,
  query: string,
  reportContent: string,
  sources: ResearchSource[],
  sections: ReportSection[],
): Promise<void> {
  // Assemble report from sections if available, otherwise use streamed content
  let finalContent: string;
  if (sections.length > 0) {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    finalContent = sorted.map((s) => {
      const trimmed = s.content.trimStart();
      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        return s.content;
      }
      return `## ${s.heading}\n\n${s.content}`;
    }).join("\n\n");
  } else {
    finalContent = reportContent;
  }

  // Generate a title from the content or fall back to the query
  let title: string | null = null;
  const h1Match = finalContent.match(/^#\s+(.+)/m);
  if (h1Match) {
    title = h1Match[1].trim().slice(0, 80);
  } else {
    title = query.slice(0, 80);
  }

  await db
    .update(researchReports)
    .set({
      reportContent: finalContent,
      title,
      sources: sources.map((s) => ({
        url: s.url,
        title: s.title,
        summary: s.summary,
        relevance: s.relevance,
      })),
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(researchReports.id, reportId));
}

/**
 * Persist a refinement result to the research_report_versions table.
 */
export async function persistRefinementResult(
  reportId: string,
  versionId: string,
  reportContent: string,
  sources: ResearchSource[],
  sections: ReportSection[],
): Promise<void> {
  let finalContent: string;
  if (sections.length > 0) {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    finalContent = sorted.map((s) => {
      const trimmed = s.content.trimStart();
      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        return s.content;
      }
      return `## ${s.heading}\n\n${s.content}`;
    }).join("\n\n");
  } else {
    finalContent = reportContent;
  }

  await db
    .update(researchReportVersions)
    .set({
      reportContent: finalContent,
      sources: sources.map((s) => ({
        url: s.url,
        title: s.title,
        summary: s.summary,
        relevance: s.relevance,
      })),
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(researchReportVersions.id, versionId));

  // Also update the main report with the latest content
  await db
    .update(researchReports)
    .set({
      reportContent: finalContent,
      sources: sources.map((s) => ({
        url: s.url,
        title: s.title,
        summary: s.summary,
        relevance: s.relevance,
      })),
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(researchReports.id, reportId));
}

/**
 * Update research report status in the database.
 */
export async function updateResearchStatus(
  reportId: string,
  status: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.update(researchReports).set({
    status,
    config: metadata ?? {},
    updatedAt: new Date(),
  }).where(eq(researchReports.id, reportId));
}

// --- Redis publishing activity wrappers ---

export async function publishResearchStatusActivity(
  channelId: string,
  status: ResearchStatus,
  phase?: string,
): Promise<void> {
  await publishResearchStatus(channelId, status, phase);
}

export async function publishResearchProgressActivity(
  channelId: string,
  progressType: ResearchProgressType,
  message: string,
): Promise<void> {
  await publishResearchProgress(channelId, progressType, message);
}

export async function publishResearchDoneActivity(
  channelId: string,
  data: { reportId: string; sourcesCount: number },
): Promise<void> {
  await publishResearchDone(channelId, data);
}

export async function publishResearchErrorActivity(
  channelId: string,
  message: string,
): Promise<void> {
  await publishResearchError(channelId, message);
}
