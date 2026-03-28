import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./CodeBlock";
import { DynamicWidget, type WidgetConfig } from "../chat/DynamicWidget";
import { parseWidgetConfig } from "../chat/widgets/schemas";
import { ExcalidrawDiagram } from "../chat/ExcalidrawDiagram";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/Table";
import { PenTool, Play } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  /** YouTube video ID from conversation context — enables timestamp auto-linking even when the URL isn't in this message */
  youtubeVideoId?: string;
}

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useMemo(() => `mermaid-${Math.random().toString(36).slice(2, 9)}`, []);
  const [excalidrawScene, setExcalidrawScene] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (excalidrawScene) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = `<pre class="text-xs text-danger p-2">Failed to render diagram</pre>`;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code, id, excalidrawScene]);

  const handleConvert = useCallback(async () => {
    setConverting(true);
    try {
      const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
      const { elements, files } = await parseMermaidToExcalidraw(code);
      setExcalidrawScene(JSON.stringify({
        type: "excalidraw",
        version: 2,
        elements: elements ?? [],
        appState: { viewBackgroundColor: "#ffffff", gridSize: null },
        files: files ?? {},
      }));
    } catch {
      // Silently fail — keep mermaid view
    } finally {
      setConverting(false);
    }
  }, [code]);

  if (excalidrawScene) {
    return (
      <div className="my-3 rounded-xl bg-surface-secondary border border-border overflow-hidden">
        <ExcalidrawDiagram
          artifactId=""
          initialScene={excalidrawScene}
          readOnly
        />
      </div>
    );
  }

  return (
    <div className="my-3 rounded-xl bg-surface-secondary border border-border overflow-hidden">
      <div className="p-4 overflow-x-auto">
        <div ref={ref} className="flex justify-center" />
      </div>
      <div className="flex justify-end px-3 py-1 border-t border-border">
        <button
          onClick={handleConvert}
          disabled={converting}
          className="text-[10px] text-text-tertiary hover:text-text-secondary flex items-center gap-1"
        >
          <PenTool className="h-3 w-3" />
          {converting ? "Converting..." : "Open in Excalidraw"}
        </button>
      </div>
    </div>
  );
}

const CSV_PAGE_SIZE = 50;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function CsvTable({ csv }: { csv: string }) {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const { header, allRows } = useMemo(() => {
    const lines = csv.trim().split("\n").filter(Boolean);
    const parsed = lines.map(parseCsvLine);
    if (parsed.length === 0) return { header: [], allRows: [] };
    return { header: parsed[0], allRows: parsed.slice(1) };
  }, [csv]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return allRows;
    const lower = searchTerm.toLowerCase();
    return allRows.filter((row) => row.some((cell) => cell.toLowerCase().includes(lower)));
  }, [allRows, searchTerm]);

  if (header.length === 0) return null;

  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / CSV_PAGE_SIZE);
  const isLarge = allRows.length > CSV_PAGE_SIZE;
  const pageRows = isLarge ? filteredRows.slice(page * CSV_PAGE_SIZE, (page + 1) * CSV_PAGE_SIZE) : filteredRows;

  return (
    <div className="my-3 rounded-xl border border-border overflow-hidden">
      {/* Header bar for large tables */}
      {isLarge && (
        <div className="flex items-center gap-3 px-3 py-2 bg-surface-secondary border-b border-border text-xs">
          <span className="text-text-secondary font-medium">
            {totalRows.toLocaleString()} rows
            {searchTerm && totalRows !== allRows.length && ` (filtered from ${allRows.length.toLocaleString()})`}
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            placeholder="Filter rows..."
            className="flex-1 max-w-xs h-6 px-2 text-xs rounded border border-border bg-surface text-text placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-1.5 py-0.5 rounded border border-border text-text-secondary hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                &lsaquo;
              </button>
              <span className="text-text-tertiary tabular-nums">
                {page + 1}/{totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-1.5 py-0.5 rounded border border-border text-text-secondary hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              >
                &rsaquo;
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 bg-surface-secondary z-10">
            <TableRow className="border-b border-border">
              {header.map((cell, i) => (
                <TableHead key={i} className="px-3 py-2 text-left font-medium text-text normal-case tracking-normal whitespace-nowrap">{cell}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, i) => (
              <TableRow key={i} className="hover:bg-muted/30">
                {row.map((cell, j) => (
                  <TableCell key={j} className="px-3 py-1.5 text-text-secondary whitespace-nowrap max-w-[300px] truncate" title={cell}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Static plugin arrays — avoids re-creating on every render which forces
// ReactMarkdown to re-initialise its unified processor pipeline.
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

// Static component overrides — same reason as above: a stable reference lets
// ReactMarkdown skip unnecessary reconciliation work.
const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1({ children }) {
    return (
      <h1 className="text-base font-semibold tracking-tight text-text mt-5 mb-2 first:mt-0">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="text-[15px] font-semibold tracking-tight text-text mt-5 mb-1.5 first:mt-0">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="text-[13.5px] font-semibold text-text mt-4 mb-1 first:mt-0">
        {children}
      </h3>
    );
  },
  p({ children }) {
    return (
      <p className="my-2.5 first:mt-0 last:mb-0 leading-[1.7] text-text-secondary">
        {children}
      </p>
    );
  },
  a({ href, children }) {
    // sandbox: URIs are internal file references — render as plain text
    if (href?.startsWith("sandbox:")) {
      return <span className="text-accent font-medium">{children}</span>;
    }
    // YouTube timestamp links — render as inline video timestamp chips
    if (href) {
      const ytMatch = href.match(/(?:youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11}))/);
      const tMatch = href.match(/[?&]t=(\d+)/);
      if (ytMatch && tMatch) {
        const seconds = parseInt(tMatch[1], 10);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const timestamp = hours > 0
          ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
          : `${minutes}:${String(secs).padStart(2, "0")}`;

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-mono no-underline"
          >
            <Play className="h-3 w-3" fill="currentColor" />
            <span>{timestamp}</span>
            {children && typeof children !== "string" ? null : children && children !== href ? (
              <span className="text-text-secondary font-sans text-xs ml-0.5 max-w-[200px] truncate">{children}</span>
            ) : null}
          </a>
        );
      }
    }
    // Internal app links (e.g. /conversations/uuid) — use client-side navigation
    const isInternal = href && /^\/(?:conversations|folders|search)(\/|$)/.test(href);
    if (isInternal) {
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault();
            // TanStack Router listens for popstate events on the history
            window.history.pushState({}, "", href);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          className="text-accent font-medium no-underline hover:underline hover:decoration-accent/40 transition-colors break-words"
        >
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent font-medium no-underline hover:underline hover:decoration-accent/40 transition-colors break-words"
      >
        {children}
      </a>
    );
  },
  strong({ children }) {
    return <strong className="font-semibold text-text">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic text-text-secondary">{children}</em>;
  },
  ul({ children }) {
    return (
      <ul className="my-2 pl-4 space-y-1 list-disc marker:text-text-tertiary/60">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="my-2 pl-4 space-y-1 list-decimal marker:text-text-tertiary/60">
        {children}
      </ol>
    );
  },
  li({ children }) {
    return (
      <li className="pl-1 text-text-secondary leading-[1.65]">
        {children}
      </li>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-2 border-primary/30 pl-3.5 text-text-secondary italic [&_p]:my-1">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-4 border-border/60" />;
  },
  table({ children }) {
    return (
      <div className="my-3 rounded-lg border border-border/60">
        <Table className="text-xs">
          {children}
        </Table>
      </div>
    );
  },
  thead({ children }) {
    return (
      <TableHeader className="bg-surface-tertiary/50">{children}</TableHeader>
    );
  },
  th({ children }) {
    return (
      <TableHead className="px-3 py-2 text-[11px] border-b border-border/60">
        {children}
      </TableHead>
    );
  },
  td({ children }) {
    return (
      <TableCell className="px-3 py-2 text-text-secondary border-b border-border/30">
        {children}
      </TableCell>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children, ...rest }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (match) {
      const lang = match[1].toLowerCase();

      if (lang === "mermaid") {
        return <MermaidDiagram code={codeString} />;
      }

      if (lang === "csv") {
        return <CsvTable csv={codeString} />;
      }

      if (lang === "widget") {
        try {
          const raw = JSON.parse(codeString);
          const result = parseWidgetConfig(raw);
          if (result.ok) {
            return <DynamicWidget config={raw as WidgetConfig} />;
          }
          // Valid JSON but invalid widget config — show as JSON with context
          return <CodeBlock code={codeString} language="json" />;
        } catch {
          // Malformed JSON (possibly mid-stream) — show as code block
        }
      }

      return <CodeBlock code={codeString} language={lang} />;
    }

    // Inline code
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-surface-tertiary/70 text-[12px] font-mono text-text"
        {...rest}
      >
        {children}
      </code>
    );
  },
};

/**
 * Auto-linkify bare YouTube timestamps (e.g. "0:00", "**1:30**", "at 5:04") when the
 * message content contains a YouTube URL. Converts them to markdown links that the
 * `a` component renders as clickable timestamp chips. Operates independently of LLM
 * prompting — works regardless of how the agent formats its response.
 */
function linkifyYouTubeTimestamps(text: string, fallbackVideoId?: string): string {
  // Extract YouTube video ID from the content, or use fallback from conversation context
  const ytUrlMatch = text.match(
    /(?:youtube\.com\/watch\?[^\s)]*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  const videoId = ytUrlMatch?.[1] ?? fallbackVideoId;
  if (!videoId) return text;

  const tsToSeconds = (ts: string): number => {
    const parts = ts.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  };

  const makeLink = (ts: string) => {
    const secs = tsToSeconds(ts);
    return `[${ts}](https://www.youtube.com/watch?v=${videoId}&t=${secs})`;
  };

  // Timestamp pattern: M:SS, MM:SS, or H:MM:SS
  const TS = `(\\d{1,2}:\\d{2}(?::\\d{2})?)`;

  const lines = text.split("\n");
  let inCodeFence = false;

  return lines.map((line) => {
    if (line.startsWith("```")) {
      inCodeFence = !inCodeFence;
      return line;
    }
    if (inCodeFence) return line;

    // Skip lines that already have markdown links with timestamps
    if (/\[\d{1,2}:\d{2}(?::\d{2})?\]\(https?:\/\//.test(line)) return line;

    // Replace bold timestamp ranges: **1:00 to 2:00** or **1:00 and 2:00**
    line = line.replace(
      new RegExp(`\\*\\*${TS}\\s+(?:to|and|–|-)\\s+${TS}\\*\\*`, "g"),
      (_, ts1, ts2) => `${makeLink(ts1)} to ${makeLink(ts2)}`,
    );

    // Replace bold single timestamps: **MM:SS**
    line = line.replace(
      new RegExp(`\\*\\*${TS}\\*\\*`, "g"),
      (_, ts) => makeLink(ts),
    );

    // Replace remaining bare timestamps at word boundaries
    line = line.replace(
      new RegExp(`(?<![\\[\\d/.:=])\\b${TS}\\b(?![\\]\\d/.:}])(?!\\])`, "g"),
      (match, ts, offset) => {
        const before = line.slice(0, offset);
        // Don't replace inside markdown links [...]
        const openBracket = before.lastIndexOf("[");
        const closeBracket = before.lastIndexOf("]");
        if (openBracket > closeBracket) return match;
        // Don't replace inside URLs
        if (/https?:\/\/\S*$/.test(before)) return match;

        return makeLink(ts);
      },
    );

    return line;
  }).join("\n");
}

/**
 * Detect large blocks of CSV-like content (many comma-separated lines not in a code fence)
 * and wrap them in ```csv fences so the CsvTable renderer handles them with pagination.
 */
function wrapLargeCsvBlocks(text: string): string {
  // Don't process if already mostly code fences
  if ((text.match(/```/g) || []).length > 4) return text;

  const lines = text.split("\n");
  let result: string[] = [];
  let csvBlock: string[] = [];
  let inCodeFence = false;

  const flushCsv = () => {
    if (csvBlock.length > 20) {
      // Large CSV block detected — wrap in fence
      result.push("```csv");
      result.push(...csvBlock);
      result.push("```");
    } else {
      // Small block — keep as-is
      result.push(...csvBlock);
    }
    csvBlock = [];
  };

  const isCsvLine = (line: string) => {
    // A line is CSV-like if it has 2+ commas and no markdown formatting
    const commas = (line.match(/,/g) || []).length;
    if (commas < 2) return false;
    // Skip lines that look like markdown (headers, lists, links)
    if (/^#{1,6}\s|^\s*[-*]\s|^\s*\d+\.\s|^\[/.test(line)) return false;
    return true;
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushCsv();
      inCodeFence = !inCodeFence;
      result.push(line);
      continue;
    }

    if (inCodeFence) {
      result.push(line);
      continue;
    }

    if (isCsvLine(line)) {
      csvBlock.push(line);
    } else {
      flushCsv();
      result.push(line);
    }
  }

  flushCsv();
  return result.join("\n");
}

const MAX_MARKDOWN_CHARS = 30_000; // Beyond this, markdown parsing becomes sluggish

export function MarkdownRenderer({ content, youtubeVideoId }: MarkdownRendererProps) {
  const normalized = useMemo(
    () => {
      let text = content.replace(/<br\s*\/?>/gi, "\n");
      // Auto-linkify bare YouTube timestamps into clickable markdown links
      text = linkifyYouTubeTimestamps(text, youtubeVideoId);
      // Auto-detect and wrap large inline CSV blocks for paginated rendering
      text = wrapLargeCsvBlocks(text);
      // If content is still extremely large after CSV wrapping, truncate the non-fenced parts
      if (text.length > MAX_MARKDOWN_CHARS) {
        // Keep code fences intact (they use efficient paginated renderers) but truncate prose
        const parts = text.split(/(```[\s\S]*?```)/g);
        let budget = MAX_MARKDOWN_CHARS;
        const kept: string[] = [];
        for (const part of parts) {
          if (part.startsWith("```")) {
            // Code fences are rendered efficiently — always keep
            kept.push(part);
          } else if (budget > 0) {
            if (part.length <= budget) {
              kept.push(part);
              budget -= part.length;
            } else {
              kept.push(part.slice(0, budget) + "\n\n*[... content truncated for display]*");
              budget = 0;
            }
          }
        }
        text = kept.join("");
      }
      return text;
    },
    [content],
  );

  return (
    <div className="nova-markdown max-w-none text-[13.5px] leading-[1.7] text-text overflow-hidden break-words">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        children={normalized}
        components={MD_COMPONENTS}
      />
    </div>
  );
}
