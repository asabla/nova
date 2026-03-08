import { Loader2, Check, AlertCircle, Globe, Link } from "lucide-react";

export interface ToolStatus {
  name: string;
  status: "running" | "completed" | "error";
}

const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching the web",
  fetch_url: "Fetching page",
};

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Globe,
  fetch_url: Link,
};

export function ToolStatusChip({ name, status }: ToolStatus) {
  const label = TOOL_LABELS[name] ?? name;
  const Icon = TOOL_ICONS[name];

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      {Icon && <Icon className="h-3 w-3" />}
      <span>{label}</span>
      {status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
      {status === "completed" && <Check className="h-3 w-3 text-success" />}
      {status === "error" && <AlertCircle className="h-3 w-3 text-danger" />}
    </span>
  );
}

export function ToolStatusBar({ tools }: { tools: ToolStatus[] }) {
  if (tools.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {tools.map((tool, i) => (
        <ToolStatusChip key={`${tool.name}-${i}`} {...tool} />
      ))}
    </div>
  );
}
