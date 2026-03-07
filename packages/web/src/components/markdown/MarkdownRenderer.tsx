import { useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
  content: string;
}

function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useMemo(() => `mermaid-${Math.random().toString(36).slice(2, 9)}`, []);

  useEffect(() => {
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
  }, [code, id]);

  return (
    <div className="my-3 p-4 rounded-xl bg-surface-secondary border border-border overflow-x-auto">
      <div ref={ref} className="flex justify-center" />
    </div>
  );
}

function CsvTable({ csv }: { csv: string }) {
  const rows = useMemo(() => {
    const lines = csv.trim().split("\n").filter(Boolean);
    return lines.map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  }, [csv]);

  if (rows.length === 0) return null;
  const [header, ...body] = rows;

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-secondary">
            {header.map((cell, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium text-text border-b border-border">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className="hover:bg-surface-secondary/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-text-secondary border-b border-border">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none text-text [&_a]:text-primary [&_a]:underline [&_code]:bg-surface-tertiary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:m-0 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:marker:text-text-tertiary [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:leading-relaxed [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_.katex]:text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        children={content}
        components={{
          code({ className, children, ...rest }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (match) {
              const lang = match[1].toLowerCase();

              // Mermaid diagrams
              if (lang === "mermaid") {
                return <MermaidDiagram code={codeString} />;
              }

              // CSV data as sortable table
              if (lang === "csv") {
                return <CsvTable csv={codeString} />;
              }

              return <CodeBlock code={codeString} language={lang} />;
            }

            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      />
    </div>
  );
}
