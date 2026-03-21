import { useState, useMemo } from "react";
import { Columns2, AlignLeft } from "lucide-react";
import * as Diff from "diff";
import clsx from "clsx";

export function DiffWidget({ params }: { params?: Record<string, string> }) {
  const original = params?.original ?? "";
  const modified = params?.modified ?? "";
  const language = params?.language;
  const initialMode = params?.mode === "split" ? "split" : "unified";

  const [viewMode, setViewMode] = useState<"unified" | "split">(initialMode);

  const changes = useMemo(() => Diff.diffLines(original, modified), [original, modified]);

  const { additions, deletions } = useMemo(() => {
    let add = 0;
    let del = 0;
    for (const part of changes) {
      const lines = part.value.replace(/\n$/, "").split("\n");
      if (part.added) add += lines.length;
      if (part.removed) del += lines.length;
    }
    return { additions: add, deletions: del };
  }, [changes]);

  const isIdentical = additions === 0 && deletions === 0;

  if (isIdentical) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="text-sm text-text-tertiary">No differences found</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            <span className="text-green-400">+{additions}</span>
            {" "}
            <span className="text-red-400">-{deletions}</span>
          </span>
          {language && (
            <span className="text-xs text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={() => setViewMode((m) => (m === "unified" ? "split" : "unified"))}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          {viewMode === "unified" ? (
            <>
              <Columns2 className="h-3 w-3" />
              Split
            </>
          ) : (
            <>
              <AlignLeft className="h-3 w-3" />
              Unified
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface-secondary">
        {viewMode === "unified" ? (
          <UnifiedView changes={changes} />
        ) : (
          <SplitView changes={changes} />
        )}
      </div>
    </div>
  );
}

function UnifiedView({ changes }: { changes: Diff.Change[] }) {
  let oldLine = 1;
  let newLine = 1;

  return (
    <div className="font-mono text-xs">
      {changes.map((part, i) => {
        const lines = part.value.replace(/\n$/, "").split("\n");
        const block = lines.map((line, j) => {
          const currentOld = oldLine;
          const currentNew = newLine;

          if (part.added) {
            newLine++;
          } else if (part.removed) {
            oldLine++;
          } else {
            oldLine++;
            newLine++;
          }

          return (
            <div
              key={`${i}-${j}`}
              className={clsx(
                "flex",
                part.added && "bg-green-500/10",
                part.removed && "bg-red-500/10",
              )}
            >
              <span className="w-10 shrink-0 text-right pr-1 text-text-tertiary select-none border-r border-border">
                {part.added ? "" : currentOld}
              </span>
              <span className="w-10 shrink-0 text-right pr-1 text-text-tertiary select-none border-r border-border">
                {part.removed ? "" : currentNew}
              </span>
              <span
                className={clsx(
                  "w-5 shrink-0 text-center select-none",
                  part.added && "text-green-400",
                  part.removed && "text-red-400",
                )}
              >
                {part.added ? "+" : part.removed ? "-" : " "}
              </span>
              <span
                className={clsx(
                  "flex-1 whitespace-pre",
                  part.added && "text-green-400",
                  part.removed && "text-red-400",
                  !part.added && !part.removed && "text-text",
                )}
              >
                {line}
              </span>
            </div>
          );
        });

        return block;
      })}
    </div>
  );
}

function SplitView({ changes }: { changes: Diff.Change[] }) {
  const leftLines: { num: number; text: string; type: "removed" | "unchanged" | "empty" }[] = [];
  const rightLines: { num: number; text: string; type: "added" | "unchanged" | "empty" }[] = [];

  let oldLine = 1;
  let newLine = 1;

  for (const part of changes) {
    const lines = part.value.replace(/\n$/, "").split("\n");

    if (part.added) {
      for (const line of lines) {
        leftLines.push({ num: 0, text: "", type: "empty" });
        rightLines.push({ num: newLine++, text: line, type: "added" });
      }
    } else if (part.removed) {
      for (const line of lines) {
        leftLines.push({ num: oldLine++, text: line, type: "removed" });
        rightLines.push({ num: 0, text: "", type: "empty" });
      }
    } else {
      for (const line of lines) {
        leftLines.push({ num: oldLine++, text: line, type: "unchanged" });
        rightLines.push({ num: newLine++, text: line, type: "unchanged" });
      }
    }
  }

  return (
    <div className="flex font-mono text-xs">
      <div className="flex-1 min-w-0 border-r border-border">
        {leftLines.map((line, i) => (
          <div
            key={i}
            className={clsx(
              "flex",
              line.type === "removed" && "bg-red-500/10",
            )}
          >
            <span className="w-10 shrink-0 text-right pr-1 text-text-tertiary select-none border-r border-border">
              {line.num > 0 ? line.num : ""}
            </span>
            <span
              className={clsx(
                "flex-1 whitespace-pre pl-1",
                line.type === "removed" && "text-red-400",
                line.type === "unchanged" && "text-text",
                line.type === "empty" && "text-text-tertiary",
              )}
            >
              {line.text}
            </span>
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        {rightLines.map((line, i) => (
          <div
            key={i}
            className={clsx(
              "flex",
              line.type === "added" && "bg-green-500/10",
            )}
          >
            <span className="w-10 shrink-0 text-right pr-1 text-text-tertiary select-none border-r border-border">
              {line.num > 0 ? line.num : ""}
            </span>
            <span
              className={clsx(
                "flex-1 whitespace-pre pl-1",
                line.type === "added" && "text-green-400",
                line.type === "unchanged" && "text-text",
                line.type === "empty" && "text-text-tertiary",
              )}
            >
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
