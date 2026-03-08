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
  // Normalize HTML <br> tags to newlines (LLMs sometimes emit them)
  const normalized = useMemo(
    () => content.replace(/<br\s*\/?>/gi, "\n"),
    [content],
  );

  return (
    <div className="nova-markdown max-w-none text-[13.5px] leading-[1.7] text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        children={normalized}
        components={{
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
              <div className="my-3 overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-surface-tertiary/50">{children}</thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border/60">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-text-secondary border-b border-border/30">
                {children}
              </td>
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
        }}
      />
    </div>
  );
}
