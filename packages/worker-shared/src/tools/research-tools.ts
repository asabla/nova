import { tool } from "@openai/agents";
import type { FunctionTool } from "@openai/agents";
import type { ResearchProgressType } from "@nova/shared/constants";
import {
  publishResearchSource,
  publishResearchProgress,
} from "../stream-publisher";
import { queryKnowledgeCollections, fetchFileContents } from "../research-queries";

export interface ResearchSource {
  title: string;
  url: string;
  summary: string;
  relevance: number;
}

export interface ReportSection {
  heading: string;
  content: string;
  order: number;
}

/**
 * Create research-specific tools with closure-bound state.
 * These tools accumulate sources and report sections during the agent loop,
 * and publish real-time SSE events via Redis.
 */
export function createResearchTools(opts: {
  orgId: string;
  streamChannelId: string;
  collectionIds: string[];
  fileIds: string[];
}): {
  tools: FunctionTool<any, any>[];
  getSources: () => ResearchSource[];
  getSections: () => ReportSection[];
} {
  const sources: ResearchSource[] = [];
  const sections: ReportSection[] = [];

  const queryKnowledgeTool = tool({
    name: "query_knowledge",
    description:
      "Search knowledge collections by text similarity. Returns relevant document chunks ranked by relevance score. Use this to find information from the user's internal knowledge base.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "The search query to find relevant knowledge" },
        topK: { type: "number", description: "Maximum number of results to return (default 10)" },
      },
      required: ["query", "topK"],
      additionalProperties: false,
    },
    execute: async (args: unknown) => {
      const { query, topK = 10 } = args as { query: string; topK?: number };

      if (opts.collectionIds.length === 0) {
        return { results: [], message: "No knowledge collections selected" };
      }

      const results = await queryKnowledgeCollections(
        opts.orgId,
        opts.collectionIds,
        query,
        topK,
      );

      // Record as sources and publish events
      for (const chunk of results) {
        const src: ResearchSource = {
          title: chunk.documentName || "Knowledge document",
          url: `knowledge://${chunk.collectionId}/${chunk.documentId}`,
          summary: chunk.content.slice(0, 300),
          relevance: chunk.score * 100,
        };
        sources.push(src);
        await publishResearchSource(opts.streamChannelId, {
          title: src.title,
          url: src.url,
          relevance: src.relevance,
        });
      }

      return results.map((r) => ({
        documentName: r.documentName,
        content: r.content,
        score: r.score,
        ...(r.fileId ? { fileId: r.fileId, hint: `To analyze this file's raw data, use code_execute with input_file_ids: ["${r.fileId}"]` } : {}),
      }));
    },
  });

  const fetchFilesTool = tool({
    name: "fetch_files",
    description:
      "Retrieve uploaded file contents by their IDs. Returns the text content of each file. Use this to analyze files the user has attached to the research query.",
    parameters: {
      type: "object" as const,
      properties: {
        fileIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of files to fetch. If empty, fetches all selected files.",
        },
      },
      required: ["fileIds"],
      additionalProperties: false,
    },
    execute: async (args: unknown) => {
      const { fileIds: requestedIds } = (args ?? {}) as { fileIds?: string[] };
      const ids = requestedIds && requestedIds.length > 0 ? requestedIds : opts.fileIds;

      if (ids.length === 0) {
        return { results: [], message: "No files selected" };
      }

      const results = await fetchFileContents(opts.orgId, ids);

      // Record as sources and publish events
      for (const file of results) {
        const src: ResearchSource = {
          title: file.filename,
          url: `file://${file.fileId}`,
          summary: file.content.slice(0, 300),
          relevance: 80,
        };
        sources.push(src);
        await publishResearchSource(opts.streamChannelId, {
          title: src.title,
          url: src.url,
          relevance: src.relevance,
        });
      }

      return results.map((r) => ({
        filename: r.filename,
        content: r.content,
      }));
    },
  });

  const saveSourceTool = tool({
    name: "save_source",
    description:
      "Record a source that was found during research. Call this for every web page, document, or piece of evidence you want to cite in the report.",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Source title" },
        url: { type: "string", description: "Source URL" },
        summary: { type: "string", description: "Brief summary of the source content (1-2 sentences)" },
        relevance: { type: "number", description: "Relevance score 0-100" },
      },
      required: ["title", "url", "summary", "relevance"],
      additionalProperties: false,
    },
    execute: async (args: unknown) => {
      const src = args as ResearchSource;
      sources.push(src);
      await publishResearchSource(opts.streamChannelId, {
        title: src.title,
        url: src.url,
        relevance: src.relevance,
      });
      return { saved: true, totalSources: sources.length };
    },
  });

  const writeReportSectionTool = tool({
    name: "write_report_section",
    description:
      "Write or append a section to the research report. Call this incrementally as you build the report — each section will be shown to the user in real-time. Use markdown formatting including widget code blocks for charts, diagrams, and embeds.",
    parameters: {
      type: "object" as const,
      properties: {
        heading: { type: "string", description: "Section heading (e.g. 'Executive Summary', 'Key Findings')" },
        content: { type: "string", description: "Section content in markdown format" },
        order: { type: "number", description: "Section order (0-based). Use sequential numbers." },
      },
      required: ["heading", "content", "order"],
      additionalProperties: false,
    },
    execute: async (args: unknown) => {
      const section = args as ReportSection;
      // Replace existing section with same order, or append
      const existingIdx = sections.findIndex((s) => s.order === section.order);
      if (existingIdx >= 0) {
        sections[existingIdx] = section;
      } else {
        sections.push(section);
      }

      await publishResearchProgress(
        opts.streamChannelId,
        "synthesis" as ResearchProgressType,
        `Writing: ${section.heading}`,
      );

      return { saved: true, totalSections: sections.length };
    },
  });

  return {
    tools: [queryKnowledgeTool, fetchFilesTool, saveSourceTool, writeReportSectionTool],
    getSources: () => sources,
    getSections: () => sections,
  };
}
