import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  CancellationScope,
  executeChild,
  upsertSearchAttributes,
} from "@temporalio/workflow";
import type * as agentActivities from "../activities/agent-execution.activities";
import type * as agentStepActivities from "../activities/agent-step.activities";
import type * as agentRunActivities from "../activities/agent-run.activities";
import type * as smartChatActivities from "../activities/smart-chat.activities";
import type * as planningActivities from "../activities/agent-planning.activities";
import type * as contextActivities from "../activities/agent-context.activities";
import type * as streamActivities from "../activities/stream.activities";
import type {
  AgentWorkflowInput,
  AgentWorkflowResult,
  AgentWorkflowState,
  ExecutionTier,
  Plan,
  PlanNode,
  ToolCallRecord,
  UserInteractionRequest,
  UserInteractionResponse,
  EffortLevel,
} from "@nova/shared/types";

// ---------------------------------------------------------------------------
// Effort-level → prompt instructions & token caps
// (inlined — Temporal workflow sandbox prohibits lib imports)
// ---------------------------------------------------------------------------

const EFFORT_INSTRUCTIONS: Record<EffortLevel, string> = {
  low: [
    "Keep your response brief and to the point. Aim for 1-3 short paragraphs maximum.",
    "Do not elaborate beyond what is directly asked.",
    "No preamble, no summaries of what you did, no 'let me know if you need anything else' closings.",
    "If the answer is one sentence, give one sentence.",
  ].join(" "),
  medium: "Be concise but thorough. Cover key points without unnecessary elaboration. Use structured formatting to be scannable.",
  high: "Provide a thorough, detailed response. Use structured formatting. It is appropriate to be comprehensive here.",
};

const EFFORT_TOKEN_CAPS: Record<EffortLevel, number> = {
  low: 1024,
  medium: 4096,
  high: 8192,
};

function applyEffortToPrompt(systemPrompt: string | undefined, level: EffortLevel): string | undefined {
  const instructions = EFFORT_INSTRUCTIONS[level];
  if (!systemPrompt) return instructions ? `## Output Length\n${instructions}` : undefined;
  return `${systemPrompt}\n\n## Output Length\n${instructions}`;
}

// ---------------------------------------------------------------------------
// DAG executor (inlined — Temporal workflow sandbox prohibits lib imports)
// ---------------------------------------------------------------------------

function getReadyNodes(plan: Plan): PlanNode[] {
  return plan.nodes.filter(
    (node) =>
      (node.status === "pending" || node.status === "ready") &&
      node.dependencies.every((depId) => {
        const dep = plan.nodes.find((n) => n.id === depId);
        return dep?.status === "completed";
      }),
  );
}

function updateNodeStatus(
  plan: Plan,
  nodeId: string,
  status: import("@nova/shared/types").PlanNodeStatus,
): Plan {
  const node = plan.nodes.find((n) => n.id === nodeId);
  if (node) node.status = status;
  if (status === "completed" || status === "failed" || status === "skipped") {
    for (const n of plan.nodes) {
      if (n.status !== "pending") continue;
      const allDepsDone = n.dependencies.every((depId) => {
        const dep = plan.nodes.find((d) => d.id === depId);
        return dep?.status === "completed";
      });
      if (allDepsDone) n.status = "ready";
    }
  }
  return plan;
}

function isPlanComplete(plan: Plan): boolean {
  return plan.nodes.every(
    (n) => n.status === "completed" || n.status === "failed" || n.status === "skipped",
  );
}

/**
 * After a node fails, mark all transitive dependents as "skipped" since they
 * can never become ready. Returns the IDs of newly-skipped nodes.
 */
function skipUnreachableNodes(plan: Plan): string[] {
  const skipped: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of plan.nodes) {
      if (node.status !== "pending" && node.status !== "ready") continue;
      const hasFailedDep = node.dependencies.some((depId) => {
        const dep = plan.nodes.find((d) => d.id === depId);
        return dep?.status === "failed" || dep?.status === "skipped";
      });
      if (hasFailedDep) {
        node.status = "skipped";
        skipped.push(node.id);
        changed = true;
      }
    }
  }
  return skipped;
}

// ---------------------------------------------------------------------------
// Proxied activities
// ---------------------------------------------------------------------------

const {
  getAgentConfig,
  loadAgentMemory,
  saveAgentMemory,
  saveAgentMessage,
  createAgentConversation,
  executeToolCall,
  notifyAgentCompletion,
} = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

const { executeAgentStepWithSDK } = proxyActivities<typeof agentStepActivities>({
  startToCloseTimeout: "2 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 3 },
});

const { runAgentLoop } = proxyActivities<typeof agentRunActivities>({
  startToCloseTimeout: "30 minutes",
  heartbeatTimeout: "60 seconds",
  retry: { maximumAttempts: 3 },
});

const { publishDone, updateWorkflowStatus } = proxyActivities<typeof smartChatActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

const { assessTier, generateDAGPlan } = proxyActivities<typeof planningActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 2 },
});

const { summarizeContext } = proxyActivities<typeof contextActivities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 2 },
});

const {
  publishTierAssessedActivity,
  publishPlanGeneratedActivity,
  publishPlanApprovedActivity,
  publishPlanNodeStatusActivity,
  publishInteractionRequestActivity,
  publishTokenActivity,
  publishDoneActivity,
} = proxyActivities<typeof streamActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

// ---------------------------------------------------------------------------
// Signals & Queries
// ---------------------------------------------------------------------------

export const cancelSignal = defineSignal("cancel");
export const userInputSignal = defineSignal<[string]>("userInput");
export const toolApprovalSignal = defineSignal<[{ toolCallId: string; approved: boolean }]>("toolApproval");
export const userInteractionResponseSignal = defineSignal<[UserInteractionResponse]>("userInteractionResponse");
export const planApprovalSignal = defineSignal<[{ approved: boolean }]>("planApproval");

export const statusQuery = defineQuery<AgentWorkflowState>("status");

// ---------------------------------------------------------------------------
// Context size estimation
// ---------------------------------------------------------------------------

const ESTIMATED_CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_CHARS = 100_000; // ~25k tokens

function estimateContextSize(messages: { role: string; content: string }[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Main workflow
// ---------------------------------------------------------------------------

export async function agentWorkflow(input: AgentWorkflowInput): Promise<AgentWorkflowResult> {
  let cancelled = false;
  let tier: ExecutionTier = "direct";
  let plan: Plan | undefined;
  let currentNodeId: string | undefined;
  let pendingInteraction: UserInteractionRequest | undefined;
  let pendingToolApprovals: string[] = [];
  let currentStep = 0;
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let currentStatus = "running";
  let finalContent = "";
  const messageIds: string[] = [];
  const toolCallRecords: ToolCallRecord[] = [];
  const interactionResponses = new Map<string, UserInteractionResponse>();
  let pendingToolApprovalMap = new Map<string, boolean>();
  let userInputReceived: string | null = null;
  let planApproved: boolean | null = null;

  // Signal handlers
  setHandler(cancelSignal, () => { cancelled = true; });
  setHandler(userInputSignal, (msg: string) => { userInputReceived = msg; });
  setHandler(toolApprovalSignal, (approval) => {
    pendingToolApprovalMap.set(approval.toolCallId, approval.approved);
  });
  setHandler(userInteractionResponseSignal, (response) => {
    interactionResponses.set(response.requestId, response);
    pendingInteraction = undefined;
  });
  setHandler(planApprovalSignal, (approval) => {
    planApproved = approval.approved;
  });

  // Query handler
  setHandler(statusQuery, () => ({
    tier,
    plan,
    currentNodeId,
    pendingInteraction,
    pendingToolApprovals,
    status: currentStatus,
    step: currentStep,
    totalTokens,
  }));

  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "running");
  }

  const ch = input.streamChannelId;

  // ------------------------------------------------------------------
  // Tier assessment
  // ------------------------------------------------------------------

  // When the workflow is invoked from the chat stream with pending tool calls,
  // the LLM already decided what tools to call — skip planning and run direct.
  const hasPendingToolCalls = input.pendingToolCalls && input.pendingToolCalls.length > 0;

  if (input.preAssessedTier) {
    // Tier was already assessed by the API — use it directly
    tier = input.preAssessedTier;
    if (ch) {
      await publishTierAssessedActivity(ch, { tier, reasoning: "Pre-assessed by API" });
    }
  } else if (hasPendingToolCalls) {
    tier = "direct";
    if (ch) {
      await publishTierAssessedActivity(ch, { tier, reasoning: "Tool calls already requested by LLM" });
    }
  } else {
    try {
      // Build context summary from conversation history so the assessor can
      // distinguish complex first messages from simple follow-ups.
      const history = input.messageHistory ?? [];
      const priorTurns = history.filter((m) => m.role === "user" || m.role === "assistant");
      const contextSummary = priorTurns.length > 1
        ? priorTurns.slice(-6).map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join("\n")
        : undefined;

      const assessment = await assessTier({
        userMessage: input.userMessage ?? history.find((m) => m.role === "user")?.content ?? "",
        model: input.model,
        context: contextSummary,
      });
      tier = assessment.tier;

      if (ch) {
        await publishTierAssessedActivity(ch, { tier, reasoning: assessment.reasoning });
      }

      // Apply suggested effort if none provided
      if (!input.effort && assessment.suggestedEffort) {
        input.effort = { level: assessment.suggestedEffort };
      }
    } catch {
      // Default to direct on assessment failure
      tier = "direct";
    }
  }

  // Publish workflow metadata as search attributes for Temporal UI filtering.
  // These attributes must be registered first via:
  //   temporal operator search-attribute create --name NovaExecutionTier --type Keyword
  //   temporal operator search-attribute create --name NovaAgentId --type Keyword
  //   temporal operator search-attribute create --name NovaOrgId --type Keyword
  // If not registered, upsertSearchAttributes will cause activation failures,
  // so we guard with a flag passed from the workflow input.
  if (input.enableSearchAttributes) {
    upsertSearchAttributes({
      NovaExecutionTier: [tier],
      NovaAgentId: [input.agentId ?? "none"],
      NovaOrgId: [input.orgId],
    });
  }

  // ------------------------------------------------------------------
  // Route by tier
  // ------------------------------------------------------------------
  let finalStatus: AgentWorkflowResult["status"] = "completed";

  try {
    switch (tier) {
      case "direct":
        finalStatus = await runDirect(input, cancelled, () => cancelled);
        break;

      case "sequential":
      case "orchestrated":
        finalStatus = await runPlanned(input, tier);
        break;
    }
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      finalStatus = cancelled ? "cancelled" : "timeout";
    } else {
      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, "error", { errorMessage: err.message ?? String(err) });
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // Finalize
  // ------------------------------------------------------------------

  // Collect final content from plan node results (only if synthesis didn't already set it).
  // Use only the last completed node (typically the final artifact), not a raw concatenation
  // of all intermediate outputs which can be extremely verbose.
  if (plan && !finalContent) {
    const completedNodes = plan.nodes.filter((n) => n.status === "completed" && n.result?.content);
    if (completedNodes.length > 0) {
      finalContent = completedNodes[completedNodes.length - 1].result!.content;
    }
  }

  // Signal done to the SSE relay
  if (ch && tier !== "direct") {
    await publishDoneActivity(ch, {
      content: finalContent,
      usage: { prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens },
    });
  }

  if (input.workflowId) {
    const dbStatus = finalStatus === "max_steps" ? "completed" as const
      : finalStatus === "awaiting_input" ? "waiting_input" as const
      : finalStatus === "awaiting_approval" ? "waiting_approval" as const
      : finalStatus === "timeout" ? "timeout" as const
      : finalStatus === "cancelled" ? "cancelled" as const
      : "completed" as const;
    await updateWorkflowStatus(input.workflowId, dbStatus, {
      output: { tier, steps: currentStep, totalTokens, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, messageIds, terminalReason: finalStatus, model: input.model, plan },
    });
  }

  return {
    conversationId: input.conversationId,
    content: finalContent,
    messageIds,
    totalTokens,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    steps: currentStep,
    status: finalStatus,
    toolCallRecords,
    tier,
    plan,
  };

  // ==================================================================
  // TIER 1: Direct — single Agent SDK loop, no planning
  // ==================================================================

  async function runDirect(
    input: AgentWorkflowInput,
    _cancelled: boolean,
    isCancelled: () => boolean,
  ): Promise<AgentWorkflowResult["status"]> {
    // Load agent config for tool filtering
    const agent = input.agentId ? await getAgentConfig(input.orgId, input.agentId) : null;
    const allowedBuiltinTools = (agent as any)?.builtinTools ?? null;

    const messageHistory = [...(input.messageHistory ?? [])];

    // If we have pending tool calls, prepend them for the SDK
    if (input.pendingToolCalls && input.pendingToolCalls.length > 0) {
      messageHistory.push({
        role: "assistant",
        content: "",
        tool_calls: input.pendingToolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      } as any);

      for (const tc of input.pendingToolCalls) {
        messageHistory.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({ status: "pending", message: "Tool execution was deferred to workflow" }),
        } as any);
      }
    }

    // Compress context if it exceeds the token budget
    const contextChars = estimateContextSize(messageHistory);
    if (contextChars > MAX_CONTEXT_CHARS) {
      const summarized = await summarizeContext({
        messages: messageHistory,
        maxTokens: 500,
        model: input.model,
      });
      messageHistory.splice(0, messageHistory.length, ...summarized);
    }

    const rawSystemPrompt = messageHistory.find((m) => m.role === "system")?.content;
    const nonSystemHistory = messageHistory.filter((m) => m.role !== "system");

    // Apply effort-aware prompt instructions and token caps
    const effortLevel: EffortLevel = input.effort?.level ?? "medium";
    const systemPrompt = applyEffortToPrompt(rawSystemPrompt, effortLevel);
    const effortCap = EFFORT_TOKEN_CAPS[effortLevel];
    const effectiveMaxTokens = input.modelParams?.maxTokens
      ? Math.min(input.modelParams.maxTokens, effortCap)
      : effortCap;

    const loop = async () => {
      if (isCancelled()) return;

      const agentResult = await runAgentLoop({
        streamChannelId: input.streamChannelId!,
        model: input.model,
        systemPrompt,
        messageHistory: nonSystemHistory,
        temperature: input.modelParams?.temperature,
        maxTokens: effectiveMaxTokens,
        maxTurns: input.maxSteps ?? 5,
        agentId: input.agentId,
        orgId: input.orgId,
        allowedBuiltinTools,
      });

      totalTokens += agentResult.totalTokens;
      totalInputTokens += agentResult.inputTokens;
      totalOutputTokens += agentResult.outputTokens;
      currentStep = agentResult.steps;
      toolCallRecords.push(...agentResult.toolCallRecords);
    };

    const timeoutMs = (input.timeoutSeconds ?? 120) * 1000;

    try {
      await CancellationScope.withTimeout(timeoutMs, loop);
    } catch (err: any) {
      if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
        const isTimeout = err.message?.includes("timed out") && !isCancelled();
        await publishDone(input.streamChannelId!, { content: "", usage: { prompt_tokens: totalInputTokens, completion_tokens: totalOutputTokens } });
        return isTimeout ? "timeout" : "cancelled";
      }
      throw err;
    }

    return "completed";
  }

  // ==================================================================
  // TIER 2 & 3: Planned execution (sequential or orchestrated)
  // ==================================================================

  async function runPlanned(
    input: AgentWorkflowInput,
    tier: ExecutionTier,
  ): Promise<AgentWorkflowResult["status"]> {
    // Load agent config if agentId provided
    const agent = input.agentId ? await getAgentConfig(input.orgId, input.agentId) : null;
    const maxSteps = input.maxSteps ?? agent?.maxSteps ?? 25;
    const timeoutSeconds = input.timeoutSeconds ?? agent?.timeoutSeconds ?? 600;

    // Load memory and create conversation in parallel (both depend on agent config)
    let memory: Record<string, unknown> = {};
    let conversationId = input.conversationId;

    if (input.agentId && agent) {
      const needsConversation = !conversationId;
      const [memoryResult, convResult] = await Promise.all([
        loadAgentMemory(
          input.agentId,
          agent.memoryScope,
          agent.memoryScope === "per-user" ? input.userId : undefined,
        ),
        needsConversation
          ? createAgentConversation(input.orgId, input.userId, input.agentId, `Agent: ${agent.name}`)
          : null,
      ]);
      memory = memoryResult;
      if (convResult) conversationId = convResult.id;
    }

    // Build message history
    const messageHistory: { role: string; content: string }[] = [
      ...(input.messageHistory ?? []),
    ];

    if (Object.keys(memory).length > 0) {
      messageHistory.unshift({
        role: "system",
        content: `Agent memory:\n${JSON.stringify(memory)}`,
      });
    }

    if (input.userMessage && !messageHistory.some((m) => m.role === "user" && m.content === input.userMessage)) {
      messageHistory.push({ role: "user", content: input.userMessage });
    }

    // Compress context if it exceeds the token budget
    const contextChars = estimateContextSize(messageHistory);
    if (contextChars > MAX_CONTEXT_CHARS) {
      const summarized = await summarizeContext({
        messages: messageHistory,
        maxTokens: 500,
        model: input.model,
      });
      messageHistory.splice(0, messageHistory.length, ...summarized);
    }

    // Generate plan
    const availableTools = [
      { name: "web_search", description: "Search the web" },
      { name: "fetch_url", description: "Fetch URL content" },
      { name: "code_execute", description: "Execute code in a sandbox" },
      { name: "search_workspace", description: "Search organization workspace" },
    ];

    // Build a context summary of prior turns so the planner knows what was already done
    const priorTurns = messageHistory.filter(
      (m) => (m.role === "assistant" || m.role === "user") && m.content.length > 0,
    );
    const conversationContext = priorTurns.length > 1
      ? priorTurns.slice(-8).map((m) => `${m.role}: ${m.content.slice(0, 300)}`).join("\n")
      : undefined;

    plan = await generateDAGPlan({
      systemPrompt: agent?.systemPrompt ?? "",
      userMessage: input.userMessage ?? messageHistory.find((m) => m.role === "user")?.content ?? "",
      availableTools,
      model: input.model,
      tier,
      conversationContext,
    });

    if (ch) {
      await publishPlanGeneratedActivity(ch, plan);
    }

    // Plan approval gate (always for orchestrated, optional for sequential)
    if (plan.approvalRequired) {
      currentStatus = "awaiting_approval";

      // Notify frontend to show approval UI
      if (ch) {
        const approvalRequest = {
          id: `plan-approval-${plan.id}`,
          type: "approval_gate" as const,
          prompt: `Plan generated with ${plan.nodes.length} steps. Review and approve to proceed.`,
          timeoutMs: 300_000,
          nodeId: undefined,
        };
        pendingInteraction = approvalRequest;
        await publishInteractionRequestActivity(ch, approvalRequest);
      }

      // Accept approval via either planApprovalSignal or userInteractionResponseSignal
      const approvalRequestId = `plan-approval-${plan.id}`;
      const gotApproval = await condition(() => {
        // Check planApprovalSignal
        if (planApproved !== null) return true;
        // Check if interaction response was received for this approval
        const response = interactionResponses.get(approvalRequestId);
        if (response) {
          planApproved = response.approved ?? false;
          return true;
        }
        return cancelled;
      }, "5 minutes");
      pendingInteraction = undefined;
      if (!gotApproval || cancelled) return cancelled ? "cancelled" : "timeout";
      if (!planApproved) return "cancelled";

      plan.approved = true;
      if (ch) {
        await publishPlanApprovedActivity(ch, plan.id);
      }
      currentStatus = "running";
    }

    // Inject plan into system prompt
    const planText = plan.nodes
      .map((n) => `${n.id}: ${n.description}${n.tools?.length ? ` [tools: ${n.tools.join(", ")}]` : ""}`)
      .join("\n");
    messageHistory.unshift({
      role: "system",
      content: `Execution plan:\n${planText}\n\nFollow this plan step by step. Adjust if needed based on results.`,
    });

    // Mark root nodes as ready
    for (const node of plan.nodes) {
      if (node.dependencies.length === 0) {
        node.status = "ready";
      }
    }

    // Execute DAG
    let status: AgentWorkflowResult["status"] = "completed";

    const executePlan = async () => {
      while (!isPlanComplete(plan!) && !cancelled) {
        const readyNodes = getReadyNodes(plan!);
        if (readyNodes.length === 0) {
          // Check if any nodes are still running
          const hasRunning = plan!.nodes.some((n) => n.status === "running");
          if (!hasRunning) break; // Deadlock or all done
          // Wait for running nodes to finish (they'll signal via status updates)
          await condition(() => {
            return getReadyNodes(plan!).length > 0 || isPlanComplete(plan!) || cancelled;
          }, "5 minutes");
          continue;
        }

        if (tier === "orchestrated" && readyNodes.length > 1) {
          // Parallel execution via child workflows
          await executeNodesParallel(readyNodes, input, agent, conversationId, messageHistory);
        } else {
          // Sequential execution inline
          for (const node of readyNodes) {
            if (cancelled) break;
            await executeNodeInline(node, input, agent, conversationId, messageHistory, maxSteps);
          }
        }
      }
    };

    try {
      await CancellationScope.withTimeout(timeoutSeconds * 1000, executePlan);
    } catch (err: any) {
      if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
        status = cancelled ? "cancelled" : "timeout";
      } else {
        throw err;
      }
    }

    // Final synthesis: produce a clean user-facing response from all node results.
    // Skip the synthesis LLM call for single-node plans — use the node output directly.
    const completedWithContent = plan.nodes.filter((n) => n.status === "completed" && n.result?.content);
    if (completedWithContent.length === 1) {
      // Single node — use its output directly without an extra LLM call
      finalContent = completedWithContent[0].result!.content;
      if (ch) await publishTokenActivity(ch, finalContent);

      if (conversationId && input.agentId) {
        const msg = await saveAgentMessage(
          input.orgId, conversationId, finalContent, input.agentId, agent?.modelId ?? null, 0, 0,
        );
        messageIds.push(msg.id);
      }
    } else if (completedWithContent.length > 1) {
      // Truncate individual node results to avoid overflowing synthesis context.
      // Keep the last node (usually the final artifact) intact but cap planning/intermediate nodes.
      const NODE_RESULT_CAP = 12000; // ~3k tokens per intermediate node
      const nodeResults = completedWithContent
        .map((n, i) => {
          const content = n.result!.content;
          const isLast = i === completedWithContent.length - 1;
          const truncated = !isLast && content.length > NODE_RESULT_CAP
            ? content.slice(0, NODE_RESULT_CAP) + "\n\n[... truncated for brevity ...]"
            : content;
          return `[${n.id}: ${n.description}]:\n${truncated}`;
        })
        .join("\n\n");

      const synthesis = await executeAgentStepWithSDK({
        systemPrompt: [
          "You are a helpful assistant. Synthesize the gathered information into a clear, natural response.",
          "Rules:",
          "- Do NOT mention steps, subtasks, plans, or the synthesis process.",
          "- If the result contains a code artifact (HTML, code file, etc.), present ONLY the final artifact with a brief 1-2 sentence introduction. Do not include planning notes, creative direction, or validation logs.",
          "- If the result is informational (research, analysis), summarize concisely in 1-4 paragraphs.",
          "- Never repeat content that already appears in the artifact.",
          "- Never add filler closings like 'let me know if you need changes'.",
        ].join("\n"),
        modelId: input.model,
        modelParams: { ...(agent?.modelParams ?? {}), maxTokens: 4096 },
        messageHistory: [
          { role: "assistant" as const, content: nodeResults },
          { role: "user" as const, content: `Based on the information above, provide a clear response to: "${input.userMessage ?? messageHistory.filter((m) => m.role === "user").pop()?.content ?? "the user's request"}"` },
        ],
        singleTurn: true,
      });

      totalInputTokens += synthesis.usage.prompt_tokens ?? 0;
      totalOutputTokens += synthesis.usage.completion_tokens ?? 0;
      totalTokens += (synthesis.usage.prompt_tokens ?? 0) + (synthesis.usage.completion_tokens ?? 0);

      if (synthesis.content) {
        finalContent = synthesis.content;
        if (ch) await publishTokenActivity(ch, synthesis.content);

        if (conversationId && input.agentId) {
          const msg = await saveAgentMessage(
            input.orgId, conversationId, synthesis.content, input.agentId, agent?.modelId ?? null,
            synthesis.usage.prompt_tokens, synthesis.usage.completion_tokens,
          );
          messageIds.push(msg.id);
        }
      }
    }

    // Save updated memory
    if (input.agentId && agent) {
      await saveAgentMemory(input.agentId, input.orgId, agent.memoryScope, {
        lastInteraction: new Date().toISOString(),
        lastConversationId: conversationId,
      }, input.userId);

      await notifyAgentCompletion(input.orgId, input.userId, input.agentId, conversationId!, {
        steps: currentStep, totalTokens, messageIds,
      });
    }

    return status;
  }

  // ==================================================================
  // Node execution helpers
  // ==================================================================

  async function executeNodeInline(
    node: PlanNode,
    input: AgentWorkflowInput,
    agent: any,
    conversationId: string,
    messageHistory: { role: string; content: string }[],
    _maxSteps: number,
  ) {
    currentNodeId = node.id;
    updateNodeStatus(plan!, node.id, "running");
    if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: node.id, status: "running" });

    // Use a per-node activity proxy so each node shows as a separate activity in Temporal timeline
    const { runAgentLoop: runNodeAgentLoop } = proxyActivities<typeof agentRunActivities>({
      startToCloseTimeout: "30 minutes",
      heartbeatTimeout: "60 seconds",
      retry: { maximumAttempts: 3 },
      activityId: `runAgentLoop-${node.id}`,
    });

    const nodeStartTime = Date.now();

    try {
      // Use a silent channel for node execution (don't stream intermediate tokens to user)
      const nodeChannelId = `stream:node:${conversationId}:${node.id}:${Date.now()}`;

      // Build node-specific messages: use only recent history to reduce noise
      const allNonSystem = messageHistory.filter((m) => m.role !== "system");
      const nodeMessages = allNonSystem.slice(-4);

      // Summarize completed nodes so this step doesn't repeat prior work
      const completedSummary = plan!.nodes
        .filter((n) => n.status === "completed" && n.result?.content)
        .map((n) => `- ${n.id} (${n.description}): done`)
        .join("\n");
      const continuationNote = completedSummary
        ? `\n\nAlready completed steps (do NOT repeat this work):\n${completedSummary}`
        : "";

      const nodeEffort: EffortLevel = node.effort ?? input.effort?.level ?? "low";
      const nodeBase = agent?.systemPrompt
        ? `${agent.systemPrompt}\n\nYou are executing step "${node.id}": ${node.description}\nBe focused and concise. Complete this specific step only.${continuationNote}`
        : `You are executing step "${node.id}": ${node.description}\nBe focused and concise. Complete this specific step only.${continuationNote}`;
      const systemPrompt = applyEffortToPrompt(nodeBase, nodeEffort)!;

      // Run the agent loop with tools — this handles tool calls natively
      const allowedBuiltinTools = (agent as any)?.builtinTools ?? null;
      const agentResult = await runNodeAgentLoop({
        streamChannelId: nodeChannelId,
        model: node.assignedModel ?? input.model,
        systemPrompt,
        messageHistory: nodeMessages,
        temperature: input.modelParams?.temperature,
        maxTokens: Math.min(input.modelParams?.maxTokens ?? 2048, 2048),
        maxTurns: 5,
        agentId: input.agentId,
        orgId: input.orgId,
        allowedBuiltinTools,
      });

      currentStep++;
      totalTokens += agentResult.totalTokens;
      totalInputTokens += agentResult.inputTokens;
      totalOutputTokens += agentResult.outputTokens;
      toolCallRecords.push(...agentResult.toolCallRecords);

      // Add the result to conversation history for downstream nodes
      if (agentResult.content) {
        messageHistory.push({ role: "assistant", content: agentResult.content });
      }

      // Mark node completed
      updateNodeStatus(plan!, node.id, "completed");
      plan!.nodes.find((n) => n.id === node.id)!.result = {
        content: agentResult.content,
        toolCallRecords: agentResult.toolCallRecords,
        tokensUsed: agentResult.totalTokens,
        durationMs: Date.now() - nodeStartTime,
      };
      if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: node.id, status: "completed" });
    } catch (err: any) {
      updateNodeStatus(plan!, node.id, "failed");
      if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: node.id, status: "failed", detail: err.message });
      // Mark all transitive dependents as skipped
      const skippedIds = skipUnreachableNodes(plan!);
      for (const id of skippedIds) {
        if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: id, status: "skipped", detail: "Upstream dependency failed" });
      }
    }

    currentNodeId = undefined;
  }

  async function executeNodesParallel(
    nodes: PlanNode[],
    input: AgentWorkflowInput,
    agent: any,
    conversationId: string,
    messageHistory: { role: string; content: string }[],
  ) {
    const parentWorkflowId = input.workflowId ?? `agent-${conversationId}-${Date.now()}`;
    const modelId = input.model;

    // Mark all as running
    for (const node of nodes) {
      updateNodeStatus(plan!, node.id, "running");
      if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: node.id, status: "running" });
    }

    const childResults = await Promise.all(
      nodes.map((node) =>
        executeChild("agentSubtaskWorkflow", {
          workflowId: `subtask-${parentWorkflowId}-${node.id}`,
          args: [{
            parentWorkflowId,
            subtaskId: node.id,
            orgId: input.orgId,
            userId: input.userId,
            agentId: input.agentId ?? "",
            conversationId,
            streamChannelId: ch ?? `stream:subtask:${parentWorkflowId}:${node.id}`,
            task: node.description,
            context: input.userMessage ?? "",
            systemPrompt: agent?.systemPrompt,
            tools: node.tools,
            model: node.assignedModel ?? modelId,
            modelParams: input.modelParams,
            maxSteps: 10,
          }],
          taskQueue: "nova-agent",
        }),
      ),
    );

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const childResult = childResults[i] as any;
      const resultStatus = childResult.status === "completed" ? "completed" : "failed";

      totalTokens += childResult.totalTokens ?? 0;
      totalInputTokens += childResult.inputTokens ?? 0;
      totalOutputTokens += childResult.outputTokens ?? 0;
      toolCallRecords.push(...(childResult.toolCallRecords ?? []));

      plan!.nodes.find((n) => n.id === node.id)!.result = {
        content: childResult.content ?? "",
        toolCallRecords: childResult.toolCallRecords ?? [],
        tokensUsed: childResult.totalTokens ?? 0,
        durationMs: 0,
      };

      updateNodeStatus(plan!, node.id, resultStatus as any);
      if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: node.id, status: resultStatus as any });
    }

    // After processing all parallel nodes, skip any dependents of failed nodes
    const skippedIds = skipUnreachableNodes(plan!);
    for (const id of skippedIds) {
      if (ch) await publishPlanNodeStatusActivity(ch, { nodeId: id, status: "skipped", detail: "Upstream dependency failed" });
    }
  }
}
