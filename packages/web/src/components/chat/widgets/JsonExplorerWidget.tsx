import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import clsx from "clsx";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function JsonNode({ name, value, depth }: { name?: string; value: JsonValue; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [copied, setCopied] = useState(false);

  const copyValue = useCallback((v: JsonValue) => {
    const text = typeof v === "string" ? v : JSON.stringify(v);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const renderKey = name !== undefined && (
    <span className="text-text-secondary">
      {name}
      <span className="text-text-tertiary">: </span>
    </span>
  );

  if (isExpandable) {
    const entries = isArray ? value : Object.entries(value);
    const count = isArray ? value.length : Object.keys(value).length;
    const bracket = isArray ? ["[", "]"] : ["{", "}"];
    const summary = isArray ? `${count} item${count !== 1 ? "s" : ""}` : `${count} key${count !== 1 ? "s" : ""}`;

    return (
      <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-0.5 hover:bg-surface-tertiary rounded px-0.5 -ml-0.5 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-text-tertiary shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-text-tertiary shrink-0" />
          )}
          {renderKey}
          {expanded ? (
            <span className="text-text-tertiary">{bracket[0]}</span>
          ) : (
            <span className="text-text-tertiary">
              {bracket[0]}
              <span className="text-text-tertiary italic text-[10px] mx-0.5">{summary}</span>
              {bracket[1]}
            </span>
          )}
        </button>
        {expanded && (
          <div>
            {isArray
              ? (value as JsonValue[]).map((item, i) => (
                  <JsonNode key={i} name={String(i)} value={item} depth={depth + 1} />
                ))
              : Object.entries(value as Record<string, JsonValue>).map(([key, val]) => (
                  <JsonNode key={key} name={key} value={val} depth={depth + 1} />
                ))}
            <div style={{ paddingLeft: 16 }}>
              <span className="text-text-tertiary">{bracket[1]}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Leaf values
  let rendered: React.ReactNode;
  if (typeof value === "string") {
    rendered = <span className="text-green-400">&quot;{value}&quot;</span>;
  } else if (typeof value === "number") {
    rendered = <span className="text-blue-400">{String(value)}</span>;
  } else if (typeof value === "boolean") {
    rendered = <span className="text-purple-400">{String(value)}</span>;
  } else {
    rendered = <span className="text-text-tertiary italic">null</span>;
  }

  return (
    <div
      style={{ paddingLeft: depth > 0 ? 16 : 0 }}
      className="group/leaf flex items-center gap-1"
    >
      <span className="pl-4">
        {renderKey}
        {rendered}
      </span>
      <button
        type="button"
        onClick={() => copyValue(value)}
        className="opacity-0 group-hover/leaf:opacity-100 text-text-tertiary hover:text-text-secondary p-0.5 rounded transition-all"
        aria-label="Copy value"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-400" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

export function JsonExplorerWidget({ params }: { params?: Record<string, string> }) {
  const raw = params?.data ?? "";

  if (!raw) {
    return <p className="p-4 text-sm text-text-tertiary">No JSON data provided</p>;
  }

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-4 font-mono text-xs">
        <p className="text-red-400 mb-2">Invalid JSON</p>
        <pre className="text-text-tertiary whitespace-pre-wrap break-all">{raw}</pre>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3 font-mono text-xs overflow-x-auto">
      <JsonNode value={parsed} depth={0} />
    </div>
  );
}
