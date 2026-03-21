import { useState, useCallback } from "react";
import { Dices, RotateCcw } from "lucide-react";
import { clsx } from "clsx";

type DiceType = "d6" | "d20" | "coin" | "custom";

function roll(type: DiceType, sides: number): number {
  switch (type) {
    case "d6":
      return Math.floor(Math.random() * 6) + 1;
    case "d20":
      return Math.floor(Math.random() * 20) + 1;
    case "coin":
      return Math.floor(Math.random() * 2) + 1;
    case "custom":
      return Math.floor(Math.random() * sides) + 1;
  }
}

function formatResult(value: number, type: DiceType): string {
  if (type === "coin") return value === 1 ? "Heads" : "Tails";
  return String(value);
}

function formatHistoryEntry(
  values: number[],
  type: DiceType,
): string {
  const formatted = values.map((v) => formatResult(v, type));
  if (values.length === 1) {
    return formatted[0];
  }
  if (type === "coin") {
    return formatted.join(", ");
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return `[${formatted.join(", ")}] = ${sum}`;
}

export function DiceWidget({ params }: { params?: Record<string, string> }) {
  const type = (params?.type as DiceType) ?? "d6";
  const sides = params?.sides ? parseInt(params.sides, 10) : 6;
  const count = params?.count ? Math.max(1, parseInt(params.count, 10)) : 1;

  const [results, setResults] = useState<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [rolling, setRolling] = useState(false);
  const [rollCount, setRollCount] = useState(0);

  const handleRoll = useCallback(() => {
    setRolling(true);
    const newResults = Array.from({ length: count }, () => roll(type, sides));
    setResults(newResults);
    setHistory((prev) => [newResults, ...prev].slice(0, 10));
    setRollCount((prev) => prev + 1);
    setTimeout(() => setRolling(false), 300);
  }, [type, sides, count]);

  const handleReset = useCallback(() => {
    setResults([]);
    setHistory([]);
    setRollCount(0);
  }, []);

  const label =
    type === "coin" ? "Coin flip" : type === "custom" ? `d${sides}` : type;
  const isMulti = count > 1;
  const sum = results.reduce((a, b) => a + b, 0);

  return (
    <div className="px-4 py-3 text-center">
      {/* Header with label and roll counter */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="text-xs text-text-tertiary">
          {isMulti ? `${count}x ${label}` : label}
        </span>
        {rollCount > 0 && (
          <span className="text-[10px] text-text-tertiary/60 tabular-nums">
            Roll #{rollCount}
          </span>
        )}
      </div>

      {/* Result display */}
      {results.length > 0 ? (
        <div className="flex flex-col items-center gap-1">
          <div
            className={clsx(
              "inline-flex items-center gap-2 transition-transform duration-300",
              rolling && "scale-110",
            )}
          >
            {results.map((r, i) => (
              <span
                key={i}
                className={clsx(
                  "inline-flex items-center justify-center rounded-lg bg-surface-tertiary font-mono font-light text-text",
                  type === "coin"
                    ? "px-3 py-1.5 text-lg"
                    : "size-10 text-2xl",
                )}
              >
                {formatResult(r, type)}
              </span>
            ))}
          </div>
          {isMulti && type !== "coin" && (
            <span className="text-xs text-text-secondary font-mono">
              Total: {sum}
            </span>
          )}
        </div>
      ) : (
        <div className="inline-flex items-center justify-center rounded-lg bg-surface-tertiary size-10">
          <span className="text-2xl font-mono font-light text-text-tertiary">
            —
          </span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          onClick={handleRoll}
          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <Dices className="h-3 w-3" />
          Roll
        </button>
        {history.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="text-[10px] text-text-tertiary">History:</span>
          {history.slice(1).map((entry, i) => (
            <span
              key={i}
              className="text-[11px] font-mono text-text-tertiary tabular-nums"
            >
              {formatHistoryEntry(entry, type)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
