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

export function DiceWidget({ params }: { params?: Record<string, string> }) {
  const type = (params?.type as DiceType) ?? "d6";
  const sides = params?.sides ? parseInt(params.sides, 10) : 6;
  const count = params?.count ? Math.max(1, parseInt(params.count, 10)) : 1;

  const [results, setResults] = useState<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [rolling, setRolling] = useState(false);

  const handleRoll = useCallback(() => {
    setRolling(true);
    const newResults = Array.from({ length: count }, () => roll(type, sides));
    setResults(newResults);
    setHistory((prev) => [newResults, ...prev].slice(0, 10));
    setTimeout(() => setRolling(false), 300);
  }, [type, sides, count]);

  const handleReset = useCallback(() => {
    setResults([]);
    setHistory([]);
  }, []);

  const label =
    type === "coin" ? "Coin flip" : type === "custom" ? `d${sides}` : type;

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xs text-text-tertiary mb-2">
        {count > 1 ? `${count}x ${label}` : label}
      </div>

      {/* Result display */}
      {results.length > 0 ? (
        <div
          className={clsx(
            "inline-flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 transition-transform duration-300",
            rolling && "scale-110",
          )}
        >
          {results.map((r, i) => (
            <span key={i} className="text-2xl font-mono font-light text-text">
              {formatResult(r, type)}
            </span>
          ))}
        </div>
      ) : (
        <div className="inline-flex items-center rounded-lg bg-surface-tertiary px-4 py-2">
          <span className="text-2xl font-mono font-light text-text-tertiary">—</span>
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
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-2 space-y-0.5">
          <div className="text-[10px] text-text-tertiary">History</div>
          {history.map((roll, i) => (
            <div key={i} className="text-[11px] text-text-secondary">
              {roll.map((r) => formatResult(r, type)).join(", ")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
