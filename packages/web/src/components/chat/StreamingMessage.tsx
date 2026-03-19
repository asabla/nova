import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { InlineToolStatusList } from "./InlineToolStatus";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useThinkingParser } from "../../hooks/useThinkingParser";
import type { ActiveTool } from "../../hooks/useSSE";

interface StreamingMessageProps {
  content: string;
  activeTools?: ActiveTool[];
}

export function StreamingMessage({ content, activeTools }: StreamingMessageProps) {
  const timestamp = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    [],
  );

  const { visibleContent, thinkingContent, isThinking, hasThinkingContent } = useThinkingParser(content);

  return (
    <div className="flex gap-3 py-3 bg-surface-secondary/50 -mx-2 px-5 rounded-xl" style={{ contain: "content" }}>
      <div className="shrink-0 mt-0.5">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-text">NOVA</span>
          <span className="text-[10px] text-text-tertiary">
            {timestamp}
          </span>
        </div>

        {activeTools && activeTools.length > 0 && (
          <InlineToolStatusList tools={activeTools} />
        )}

        {hasThinkingContent && (
          <ThinkingIndicator content={thinkingContent} isStreaming={isThinking} />
        )}

        <div className="text-sm text-text leading-relaxed">
          {visibleContent ? (
            <MarkdownRenderer content={visibleContent} />
          ) : (
            !activeTools?.length && !isThinking && (
              <div className="flex items-center gap-1.5 py-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-text-tertiary"
                    style={{
                      animation: "pulse 1.4s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }}
                    aria-hidden="true"
                  />
                ))}
                <span className="sr-only">Loading response</span>
              </div>
            )
          )}
          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
