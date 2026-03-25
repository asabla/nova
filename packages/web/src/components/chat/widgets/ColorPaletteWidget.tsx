import { useState, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import { Copy, Check } from "lucide-react";
import { parseStringArray } from "./parse-params";

const DEFAULT_COLORS = ["#6366F1", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];

export function ColorPaletteWidget({ params }: { params?: Record<string, string> }) {
  const colors = parseStringArray(params?.colors, DEFAULT_COLORS);
  const labels = parseStringArray(params?.labels);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (copiedIndex === null) return;
    const timer = setTimeout(() => setCopiedIndex(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedIndex]);

  const handleCopy = useCallback((hex: string, index: number) => {
    navigator.clipboard.writeText(hex);
    setCopiedIndex(index);
  }, []);

  return (
    <div className="px-4 py-3">
      <div className="text-sm font-medium text-text mb-2">Color Palette</div>
      <div className="grid grid-cols-5 gap-2">
        {colors.map((hex, i) => {
          const isCopied = copiedIndex === i;
          return (
            <button
              key={i}
              onClick={() => handleCopy(hex, i)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer"
            >
              <div
                className="relative w-full aspect-square rounded-lg border border-border transition-transform group-hover:scale-105"
                style={{ backgroundColor: hex }}
              >
                <div
                  className={clsx(
                    "absolute inset-0 flex items-center justify-center rounded-lg bg-black/20 transition-opacity",
                    isCopied ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  {isCopied ? (
                    <Check className="size-4 text-white" />
                  ) : (
                    <Copy className="size-3.5 text-white" />
                  )}
                </div>
              </div>
              <div className="text-[10px] font-mono text-text-secondary leading-none">
                {isCopied ? "Copied!" : hex.toUpperCase()}
              </div>
              {labels[i] && (
                <div className="text-[10px] text-text-tertiary leading-none -mt-0.5 truncate max-w-full">
                  {labels[i]}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
