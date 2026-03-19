import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface ThinkingIndicatorProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingIndicator({ content, isStreaming }: ThinkingIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Brain className="h-3.5 w-3.5" />
        {isStreaming ? (
          <span className="flex items-center gap-1">
            Thinking
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-text-tertiary"
                  style={{
                    animation: "pulse 1.4s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                  aria-hidden="true"
                />
              ))}
            </span>
          </span>
        ) : (
          <span>Thought process</span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 ml-2 border-l-2 border-border pl-4">
          <p className="text-text-tertiary text-xs font-mono whitespace-pre-wrap">{content}</p>
        </div>
      )}
    </div>
  );
}
