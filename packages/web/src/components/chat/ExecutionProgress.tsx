import type { AgentFlowState } from "../../hooks/useSSE";
import { TierBadge } from "./TierBadge";
import { PlanDAGView } from "./PlanDAGView";
import { InteractionPanel } from "./InteractionPanel";

interface ExecutionProgressProps {
  agentFlow: AgentFlowState;
  conversationId: string;
  isStreaming: boolean;
}

export function ExecutionProgress({ agentFlow, conversationId, isStreaming }: ExecutionProgressProps) {
  const { tier, tierReasoning, plan, pendingInteraction } = agentFlow;

  // Don't show anything if no tier has been assessed
  if (!tier) return null;

  // For direct tier, only show the badge briefly (no plan to visualize)
  const showPlan = plan && (tier === "sequential" || tier === "orchestrated");

  return (
    <div className="space-y-1">
      {/* Tier badge */}
      <div className="mx-4 my-1">
        <TierBadge tier={tier} reasoning={tierReasoning} />
      </div>

      {/* Plan visualization */}
      {showPlan && (
        <PlanDAGView plan={plan} isRunning={isStreaming} />
      )}

      {/* Pending interaction */}
      {pendingInteraction && isStreaming && (
        <InteractionPanel
          request={pendingInteraction}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}
