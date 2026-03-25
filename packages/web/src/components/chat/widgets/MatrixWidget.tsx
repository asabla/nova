import { useState, useMemo } from "react";
import { clsx } from "clsx";
import { Trophy } from "lucide-react";

interface Criterion {
  name: string;
  weight: number;
}

interface Option {
  name: string;
  scores: Record<string, number>;
}

export function MatrixWidget({ params }: { params?: Record<string, string> }) {
  const parsedCriteria = useMemo<Criterion[]>(() => {
    try {
      if (!params?.criteria) return [];
      return typeof params.criteria === "string" ? JSON.parse(params.criteria) : params.criteria;
    } catch {
      return [];
    }
  }, [params?.criteria]);

  const options = useMemo<Option[]>(() => {
    try {
      if (!params?.options) return [];
      return typeof params.options === "string" ? JSON.parse(params.options) : params.options;
    } catch {
      return [];
    }
  }, [params?.options]);

  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const c of parsedCriteria) {
      map[c.name] = c.weight;
    }
    return map;
  });

  if (parsedCriteria.length === 0 || options.length === 0) {
    return <p className="p-4 text-sm text-text-tertiary">No matrix data provided</p>;
  }

  const adjustWeight = (name: string, delta: number) => {
    setWeights((prev) => ({
      ...prev,
      [name]: Math.min(10, Math.max(1, (prev[name] ?? 1) + delta)),
    }));
  };

  const weightedScores = useMemo(() => {
    const totalWeight = parsedCriteria.reduce((sum, c) => sum + (weights[c.name] ?? c.weight), 0);
    if (totalWeight === 0) return options.map(() => 0);
    return options.map((opt) => {
      const score = parsedCriteria.reduce(
        (sum, c) => sum + (opt.scores[c.name] ?? 0) * (weights[c.name] ?? c.weight),
        0,
      );
      return score / totalWeight;
    });
  }, [weights, parsedCriteria, options]);

  const winnerIndex = useMemo(() => {
    let maxIdx = 0;
    for (let i = 1; i < weightedScores.length; i++) {
      if (weightedScores[i] > weightedScores[maxIdx]) maxIdx = i;
    }
    return maxIdx;
  }, [weightedScores]);

  const bestScorePerCriterion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of parsedCriteria) {
      let best = -1;
      for (const opt of options) {
        const s = opt.scores[c.name] ?? 0;
        if (s > best) best = s;
      }
      map[c.name] = best;
    }
    return map;
  }, [parsedCriteria, options]);

  return (
    <div className="px-4 py-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-text" />
              {options.map((opt) => (
                <th key={opt.name} className="px-3 py-2 text-center text-xs font-medium text-text">
                  {opt.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsedCriteria.map((c, rowIdx) => (
              <tr
                key={c.name}
                className={clsx(rowIdx % 2 === 1 && "bg-surface-tertiary/30")}
              >
                <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{c.name}</span>
                    <span className="text-[10px] text-text-tertiary">w:{weights[c.name]}</span>
                    <button
                      type="button"
                      onClick={() => adjustWeight(c.name, -1)}
                      className="text-[10px] text-text-tertiary hover:text-text border border-border rounded px-1 leading-none py-0.5"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustWeight(c.name, 1)}
                      className="text-[10px] text-text-tertiary hover:text-text border border-border rounded px-1 leading-none py-0.5"
                    >
                      +
                    </button>
                  </div>
                </td>
                {options.map((opt) => {
                  const score = opt.scores[c.name] ?? 0;
                  const isBest = score === bestScorePerCriterion[c.name] && score > 0;
                  return (
                    <td
                      key={opt.name}
                      className={clsx(
                        "px-3 py-2 text-xs text-center",
                        isBest ? "text-primary font-medium" : "text-text-secondary",
                      )}
                    >
                      {score}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="px-3 py-2 font-medium text-xs text-text">Weighted Score</td>
              {options.map((opt, i) => {
                const isWinner = i === winnerIndex;
                return (
                  <td key={opt.name} className="px-3 py-2 text-xs text-center">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1",
                        isWinner && "bg-primary/15 rounded-md px-2 py-1 font-medium text-text",
                      )}
                    >
                      {isWinner && <Trophy className="size-3" />}
                      {weightedScores[i].toFixed(1)}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
