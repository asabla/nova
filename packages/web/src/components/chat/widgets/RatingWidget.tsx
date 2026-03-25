import { Star } from "lucide-react";
import { clsx } from "clsx";
import { useMemo } from "react";

interface RatingItem {
  label: string;
  score: number;
  max: number;
}

export function RatingWidget({ params }: { params?: Record<string, string> }) {
  const { items, overall, style } = useMemo(() => {
    let parsedItems: RatingItem[] = [];
    let parsedOverall: number | null = null;
    const parsedStyle = (params?.style ?? "bars") as "bars" | "stars";

    try {
      const itemsRaw = params?.items;
      const raw = !itemsRaw ? [] : typeof itemsRaw === "string" ? JSON.parse(itemsRaw) : itemsRaw;
      if (Array.isArray(raw)) {
        parsedItems = raw.map((item: Record<string, unknown>) => ({
          label: String(item.label ?? ""),
          score: Number(item.score ?? 0),
          max: Number(item.max ?? 10),
        }));
      }
    } catch {
      // fallback to empty
    }

    if (params?.overall) {
      try {
        parsedOverall = parseFloat(params.overall);
        if (isNaN(parsedOverall)) parsedOverall = null;
      } catch {
        parsedOverall = null;
      }
    }

    return { items: parsedItems, overall: parsedOverall, style: parsedStyle };
  }, [params]);

  if (items.length === 0 && overall === null) {
    return <p className="p-4 text-sm text-text-tertiary">No rating data provided</p>;
  }

  const overallMax = items.length > 0 ? Math.max(...items.map((i) => i.max)) : 10;

  return (
    <div className="px-4 py-3">
      {overall !== null && (
        <div className={clsx("flex flex-col items-center", items.length > 0 && "border-b border-border mb-3 pb-3")}>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-text">{overall}</span>
            {style === "stars" && (
              <div className="flex items-center gap-0.5">
                <StarRow score={overall} max={overallMax} />
              </div>
            )}
          </div>
          <span className="text-[10px] text-text-tertiary uppercase tracking-wide">Overall</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <div key={i}>
              {style === "bars" ? <BarRow item={item} /> : <StarsRow item={item} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarRow({ item }: { item: RatingItem }) {
  const ratio = item.max > 0 ? item.score / item.max : 0;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const barColor = ratio < 0.4 ? "bg-red-500" : ratio <= 0.7 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary flex-shrink-0 w-24 truncate" title={item.label}>
        {item.label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-tertiary">
        <div className={clsx("h-2 rounded-full", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text font-medium flex-shrink-0">
        {item.score}/{item.max}
      </span>
    </div>
  );
}

function StarsRow({ item }: { item: RatingItem }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary flex-shrink-0 w-24 truncate" title={item.label}>
        {item.label}
      </span>
      <div className="flex items-center gap-0.5">
        <StarRow score={item.score} max={item.max} />
      </div>
      <span className="text-xs text-text-secondary flex-shrink-0">
        {item.score}/{item.max}
      </span>
    </div>
  );
}

function StarRow({ score, max }: { score: number; max: number }) {
  const normalized = max > 0 ? (score / max) * 5 : 0;
  const stars: ("full" | "half" | "empty")[] = [];

  for (let i = 1; i <= 5; i++) {
    const diff = normalized - (i - 1);
    if (diff >= 0.75) {
      stars.push("full");
    } else if (diff >= 0.25) {
      stars.push("half");
    } else {
      stars.push("empty");
    }
  }

  return (
    <>
      {stars.map((type, i) => {
        if (type === "full") {
          return <Star key={i} className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" />;
        }
        if (type === "half") {
          return (
            <div key={i} className="relative h-3.5 w-3.5">
              <Star className="absolute inset-0 h-3.5 w-3.5 text-surface-tertiary" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <Star className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" />
              </div>
            </div>
          );
        }
        return <Star key={i} className="h-3.5 w-3.5 text-surface-tertiary" />;
      })}
    </>
  );
}
