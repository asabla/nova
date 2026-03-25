import { useMemo } from "react";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";
import { InlineToolStatusList } from "./InlineToolStatus";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { TierBadge } from "./TierBadge";
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
}

export function StreamingMessage({ content, activeTools, agentFlow, conversationId }: StreamingMessageProps) {
  const timestamp = useMemo(
    () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    [],
  );

  const { visibleContent, thinkingContent, isThinking, hasThinkingContent } = useThinkingParser(content);

  return (
    <div className="flex gap-3 py-3 bg-surface-secondary/50 -mx-2 px-5 rounded-xl" style={{ contain: "content" }}>
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

        {agentFlow?.tier && (
          <div className="my-1">
            <TierBadge tier={agentFlow.tier} reasoning={agentFlow.tierReasoning} />
          </div>
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
              <MarkdownRenderer content={visibleContent} />
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
