import { useMemo } from "react";
import { clsx } from "clsx";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { InlineToolStatusList } from "./InlineToolStatus";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { PlanDAGView } from "./PlanDAGView";
import { InteractionPanel } from "./InteractionPanel";
import { AnimatedOrb, StreamingStatusIndicator } from "./StreamingStatusIndicator";
import { useThinkingParser } from "../../hooks/useThinkingParser";
import type { ActiveTool, AgentFlowState } from "../../hooks/useSSE";

interface StreamingMessageProps {
  content: string;
  activeTools?: ActiveTool[];
  agentFlow?: AgentFlowState;
  conversationId?: string;
  youtubeVideoId?: string;
}

export function StreamingMessage({ content, activeTools, agentFlow, conversationId, youtubeVideoId }: StreamingMessageProps) {
  const timestamp = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    [],
  );

  const { visibleContent, thinkingContent, isThinking, hasThinkingContent } = useThinkingParser(content);

  return (
    <div className={clsx(
      "flex gap-3 py-3 bg-surface-secondary/50 -mx-2 px-5 rounded-xl",
      agentFlow?.tier === "direct" && "border-l-2 border-success/40",
      agentFlow?.tier === "sequential" && "border-l-2 border-primary/40",
      agentFlow?.tier === "orchestrated" && "border-l-2 border-warning/40",
    )} style={{ contain: "content" }}>
      <div className="shrink-0 mt-0.5">
        <AnimatedOrb />
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

        {agentFlow?.plan && (agentFlow.tier === "sequential" || agentFlow.tier === "orchestrated") && (
          <PlanDAGView plan={agentFlow.plan} isRunning={true} />
        )}

        {agentFlow?.pendingInteraction && conversationId && (
          <InteractionPanel
            request={agentFlow.pendingInteraction}
            conversationId={conversationId}
          />
        )}

        {hasThinkingContent && (
          <ThinkingIndicator content={thinkingContent} isStreaming={isThinking} />
        )}

        <div className="text-sm text-text leading-relaxed">
          {visibleContent ? (
            <>
              <MarkdownRenderer content={visibleContent} youtubeVideoId={youtubeVideoId} />
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" aria-hidden="true" />
            </>
          ) : (
            !isThinking && (
              <StreamingStatusIndicator
                activeTools={activeTools}
                agentFlow={agentFlow}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
