import { useMemo } from "react";
import { clsx } from "clsx";
import { Check, X } from "lucide-react";

export function ProsConsWidget({ params }: { params?: Record<string, string> }) {
  const subject = params?.subject;

  const pros = useMemo(
    () =>
      String(params?.pros ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [params?.pros],
  );

  const cons = useMemo(
    () =>
      String(params?.cons ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [params?.cons],
  );

  if (pros.length === 0 && cons.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No pros/cons data provided</p>;
  }

  return (
    <div className="px-4 py-3">
      {subject && (
        <div className="text-sm font-medium text-text mb-3 text-center">{subject}</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-green-500 text-xs font-medium mb-1.5">Pros</div>
          <div className="space-y-1.5">
            {pros.map((pro, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <Check className="size-3.5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary">{pro}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-red-500 text-xs font-medium mb-1.5">Cons</div>
          <div className="space-y-1.5">
            {cons.map((con, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <X className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary">{con}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
