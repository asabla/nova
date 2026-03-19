import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  CancellationScope,
  executeChild,
} from "@temporalio/workflow";
import type * as agentActivities from "../activities/agent-execution.activities";
import type * as agentStepActivities from "../activities/agent-step.activities";
import type * as agentRunActivities from "../activities/agent-run.activities";
import type * as smartChatActivities from "../activities/smart-chat.activities";
import type * as planningActivities from "../activities/agent-planning.activities";
import type * as contextActivities from "../activities/agent-context.activities";

// --- Proxied activities ---

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
  startToCloseTimeout: "3 minutes",
  heartbeatTimeout: "30 seconds",
  retry: { maximumAttempts: 2 },
});

const { publishDone, updateWorkflowStatus } = proxyActivities<typeof smartChatActivities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

const { generatePlan, assessComplexity } = proxyActivities<typeof planningActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 2 },
});

const { summarizeContext } = proxyActivities<typeof contextActivities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 2 },
});

// --- Types ---

export interface AgentWorkflowInput {
  mode: "chat" | "execution";
  orgId: string;
  userId: string;
  conversationId: string;
  streamChannelId?: string;
  agentId?: string;
  workflowId?: string;
  userMessage?: string;
  messageHistory?: { role: string; content: string }[];
  pendingToolCalls?: { id: string; function: { name: string; arguments: string } }[];
  model: string;
  modelParams?: { temperature?: number; maxTokens?: number };
  tools?: unknown[];
  maxSteps?: number;
  timeoutSeconds?: number;
  enablePlanning?: boolean;
}

export interface AgentWorkflowResult {
  conversationId: string;
  content: string;
  messageIds: string[];
  totalTokens: number;
  steps: number;
  status: "completed" | "cancelled" | "timeout" | "max_steps" | "awaiting_input";
  toolCallRecords: ToolCallRecord[];
  plan?: PlanResult;
}

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  durationMs: number;
}

interface PlanStep {
  number: number;
  description: string;
  tools?: string[];
  parallelGroup?: number;
}

interface PlanResult {
  steps: PlanStep[];
  reasoning: string;
}

// --- Signals & Queries ---

export const cancelSignal = defineSignal("cancel");
export const userInputSignal = defineSignal<[string]>("userInput");
export const toolApprovalSignal = defineSignal<[{ toolCallId: string; approved: boolean }]>("toolApproval");

export const statusQuery = defineQuery<{
  step: number;
  status: string;
  pendingToolCalls: string[];
  plan?: PlanResult;
}>("status");

// --- Context size estimation ---

const ESTIMATED_CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_CHARS = 100_000; // ~25k tokens, leave room for response

function estimateContextSize(messages: { role: string; content: string }[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
}

// --- Main workflow ---

export async function agentWorkflow(input: AgentWorkflowInput): Promise<AgentWorkflowResult> {
  if (input.mode === "chat") {
    return runChatMode(input);
  }
  return runExecutionMode(input);
}

// --- Chat mode: delegate to Agent SDK loop ---

async function runChatMode(input: AgentWorkflowInput): Promise<AgentWorkflowResult> {
  let cancelled = false;
  setHandler(cancelSignal, () => { cancelled = true; });

  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "running");
  }

  const messageHistory = [...(input.messageHistory ?? [])];

  // If we have pending tool calls, prepend them for the SDK to pick up
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

  let result: AgentWorkflowResult = {
    conversationId: input.conversationId,
    content: "",
    messageIds: [],
    totalTokens: 0,
    steps: 0,
    status: "completed",
    toolCallRecords: [],
  };

  const loop = async () => {
    if (cancelled) return;

    const systemPrompt = messageHistory.find((m) => m.role === "system")?.content;
    const nonSystemHistory = messageHistory.filter((m) => m.role !== "system");

    const agentResult = await runAgentLoop({
      streamChannelId: input.streamChannelId!,
      model: input.model,
      systemPrompt,
      messageHistory: nonSystemHistory,
      temperature: input.modelParams?.temperature,
      maxTokens: input.modelParams?.maxTokens,
      maxTurns: input.maxSteps ?? 5,
      agentId: input.agentId,
    });

    result = {
      conversationId: input.conversationId,
      content: agentResult.content,
      messageIds: [],
      totalTokens: agentResult.totalTokens,
      steps: agentResult.steps,
      status: "completed",
      toolCallRecords: agentResult.toolCallRecords,
    };
  };

  const timeoutMs = (input.timeoutSeconds ?? 120) * 1000;

  try {
    await CancellationScope.withTimeout(timeoutMs, loop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      const isTimeout = err.message?.includes("timed out") && !cancelled;
      cancelled = true;
      result.status = "cancelled";

      await publishDone(input.streamChannelId!, {
        content: result.content,
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      });

      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, isTimeout ? "timeout" : "cancelled");
      }
    } else {
      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, "error", {
          errorMessage: err.message ?? String(err),
        });
      }
      throw err;
    }
  }

  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "completed", {
      output: { content: result.content, totalTokens: result.totalTokens, steps: result.steps },
    });
  }

  return result;
}

// --- Execution mode: step-by-step with tool approval ---

async function runExecutionMode(input: AgentWorkflowInput): Promise<AgentWorkflowResult> {
  let cancelled = false;
  let userInputReceived: string | null = null;
  let pendingToolApprovals: Map<string, boolean> = new Map();
  let currentStep = 0;
  let currentStatus = "running";
  let pendingToolCallIds: string[] = [];
  let plan: PlanResult | undefined;

  // Signal handlers
  setHandler(cancelSignal, () => { cancelled = true; });
  setHandler(userInputSignal, (msg: string) => { userInputReceived = msg; });
  setHandler(toolApprovalSignal, (approval: { toolCallId: string; approved: boolean }) => {
    pendingToolApprovals.set(approval.toolCallId, approval.approved);
  });

  // Query handler
  setHandler(statusQuery, () => ({
    step: currentStep,
    status: currentStatus,
    pendingToolCalls: pendingToolCallIds,
    plan,
  }));

  if (input.workflowId) {
    await updateWorkflowStatus(input.workflowId, "running");
  }

  // 1. Load agent config
  const agent = await getAgentConfig(input.orgId, input.agentId!);

  const maxSteps = input.maxSteps ?? agent.maxSteps ?? 25;
  const timeoutSeconds = input.timeoutSeconds ?? agent.timeoutSeconds ?? 300;

  // 2. Load agent memory
  const memory = await loadAgentMemory(
    input.agentId!,
    agent.memoryScope,
    agent.memoryScope === "per-user" ? input.userId : undefined,
  );

  // 3. Create or use conversation
  let conversationId = input.conversationId;
  if (!conversationId) {
    const conv = await createAgentConversation(
      input.orgId,
      input.userId,
      input.agentId!,
      `Agent: ${agent.name}`,
    );
    conversationId = conv.id;
  }

  // 4. Build initial message history
  const messageHistory: { role: string; content: string }[] = [];

  if (Object.keys(memory).length > 0) {
    messageHistory.push({
      role: "system",
      content: `Agent memory:\n${JSON.stringify(memory, null, 2)}`,
    });
  }

  messageHistory.push({ role: "user", content: input.userMessage! });

  // 5. Planning phase (Phase 2)
  if (input.enablePlanning) {
    try {
      const complexity = await assessComplexity({
        userMessage: input.userMessage!,
        model: input.model ?? agent.modelId ?? "default-model",
      });

      if (complexity.shouldPlan) {
        const availableTools = [
          { name: "web_search", description: "Search the web" },
          { name: "fetch_url", description: "Fetch URL content" },
        ];

        plan = await generatePlan({
          systemPrompt: agent.systemPrompt ?? "",
          userMessage: input.userMessage!,
          availableTools,
          model: input.model ?? agent.modelId ?? "default-model",
        });

        // Inject plan into system prompt for subsequent turns
        if (plan && plan.steps.length > 0) {
          const planText = plan.steps
            .map((s) => `${s.number}. ${s.description}${s.tools?.length ? ` [tools: ${s.tools.join(", ")}]` : ""}`)
            .join("\n");
          messageHistory.unshift({
            role: "system",
            content: `Execution plan:\n${planText}\n\nFollow this plan step by step. Adjust if needed based on results.`,
          });
        }
      }
    } catch {
      // Planning is optional — continue without it
    }
  }

  // 6. Sub-agent orchestration (Phase 3): if plan has parallel groups, spawn child workflows
  const messageIds: string[] = [];
  let totalTokens = 0;
  let finalStatus: AgentWorkflowResult["status"] = "completed";
  const toolCallRecords: ToolCallRecord[] = [];

  if (plan && plan.steps.length > 1 && plan.steps.some((s) => s.parallelGroup !== undefined)) {
    const parentWorkflowId = input.workflowId ?? `agent-${conversationId}-${Date.now()}`;
    const modelId = input.model ?? agent.modelId ?? "default-model";

    // Group steps by parallelGroup
    const groups = new Map<number, PlanStep[]>();
    const sequentialSteps: PlanStep[] = [];
    for (const step of plan.steps) {
      if (step.parallelGroup !== undefined) {
        const group = groups.get(step.parallelGroup) ?? [];
        group.push(step);
        groups.set(step.parallelGroup, group);
      } else {
        sequentialSteps.push(step);
      }
    }

    // Execute groups in order of parallelGroup number
    const sortedGroupIds = [...groups.keys()].sort((a, b) => a - b);
    const allChildResults: { description: string; content: string; status: string }[] = [];

    for (const groupId of sortedGroupIds) {
      const groupSteps = groups.get(groupId)!;

      // Spawn child workflows in parallel for this group
      const childResults = await Promise.all(
        groupSteps.map((step) =>
          executeChild("agentSubtaskWorkflow", {
            workflowId: `subtask-${parentWorkflowId}-${step.number}`,
            args: [{
              parentWorkflowId,
              subtaskId: `step-${step.number}`,
              orgId: input.orgId,
              userId: input.userId,
              agentId: input.agentId!,
              conversationId: conversationId!,
              streamChannelId: input.streamChannelId ?? `stream:subtask:${parentWorkflowId}:${step.number}`,
              task: step.description,
              context: input.userMessage!,
              systemPrompt: agent.systemPrompt,
              tools: step.tools,
              model: modelId,
              modelParams: input.modelParams,
              maxSteps: 10,
            }],
            taskQueue: "nova-main",
          })
        ),
      );

      for (let i = 0; i < groupSteps.length; i++) {
        const childResult = childResults[i] as any;
        totalTokens += childResult.totalTokens ?? 0;
        toolCallRecords.push(...(childResult.toolCallRecords ?? []));
        allChildResults.push({
          description: groupSteps[i].description,
          content: childResult.content ?? "",
          status: childResult.status ?? "completed",
        });
      }
    }

    // Result synthesis (Phase 3.3): make a final LLM call to combine subtask results
    if (allChildResults.length > 0) {
      const synthesisHistory: { role: string; content: string }[] = [
        ...allChildResults.map((r) => ({
          role: "assistant" as const,
          content: `[Subtask: ${r.description}]: ${r.content}`,
        })),
        {
          role: "user",
          content: `Combine these subtask results into a comprehensive response to the original request: "${input.userMessage}"`,
        },
      ];

      const synthesis = await executeAgentStepWithSDK({
        systemPrompt: "Synthesize subtask results into a coherent, comprehensive response. Do not mention subtasks or the synthesis process.",
        modelId,
        modelParams: agent.modelParams,
        messageHistory: synthesisHistory,
        singleTurn: true,
      });

      totalTokens += (synthesis.usage.prompt_tokens ?? 0) + (synthesis.usage.completion_tokens ?? 0);

      if (synthesis.content) {
        const msg = await saveAgentMessage(
          input.orgId, conversationId!, synthesis.content, input.agentId!, agent.modelId,
          synthesis.usage.prompt_tokens, synthesis.usage.completion_tokens,
        );
        messageIds.push(msg.id);
      }
    }

    // Skip the main agent loop — we used sub-agents
  } else {

  // Standard agent loop (no sub-agents)
  const agentLoop = async () => {
    while (currentStep < maxSteps && !cancelled) {
      currentStep++;

      // Context summarization if history is too large
      if (estimateContextSize(messageHistory) > MAX_CONTEXT_CHARS) {
        try {
          const summarized = await summarizeContext({
            messages: messageHistory,
            maxTokens: Math.floor(MAX_CONTEXT_CHARS / ESTIMATED_CHARS_PER_TOKEN),
            model: input.model ?? agent.modelId ?? "default-model",
          });
          messageHistory.length = 0;
          messageHistory.push(...summarized);
        } catch {
          // Continue with full history if summarization fails
        }
      }

      const result = await executeAgentStepWithSDK({
        systemPrompt: agent.systemPrompt,
        modelId: input.model ?? agent.modelId ?? "default-model",
        modelParams: agent.modelParams,
        messageHistory,
        agentId: input.agentId,
        singleTurn: true,
      });

      totalTokens += (result.usage.prompt_tokens ?? 0) + (result.usage.completion_tokens ?? 0);

      // Save assistant message
      if (result.content) {
        const msg = await saveAgentMessage(
          input.orgId,
          conversationId!,
          result.content,
          input.agentId!,
          agent.modelId,
          result.usage.prompt_tokens,
          result.usage.completion_tokens,
        );
        messageIds.push(msg.id);
        messageHistory.push({ role: "assistant", content: result.content });
      }

      // Check if agent is requesting user input
      if (result.toolCalls.some((tc) => tc.name === "__request_user_input")) {
        currentStatus = "awaiting_input";
        const inputRequest = result.toolCalls.find((tc) => tc.name === "__request_user_input");
        const prompt = inputRequest?.arguments
          ? JSON.parse(inputRequest.arguments).prompt ?? "Please provide input:"
          : "Please provide input:";

        await saveAgentMessage(input.orgId, conversationId!, prompt, input.agentId!, agent.modelId, 0, 0);

        const gotInput = await condition(() => userInputReceived !== null || cancelled, "10 minutes");
        if (!gotInput || cancelled) {
          finalStatus = cancelled ? "cancelled" : "timeout";
          break;
        }

        messageHistory.push({ role: "user", content: userInputReceived! });
        userInputReceived = null;
        currentStatus = "running";
        continue;
      }

      // Handle tool calls
      if (result.toolCalls.length > 0) {
        const toolApprovalMode = agent.toolApprovalMode ?? "auto";

        if (toolApprovalMode === "always-ask") {
          // Batch-present all pending tool calls, wait for all approvals
          pendingToolCallIds = result.toolCalls.map((tc) => tc.id);
          currentStatus = "awaiting_approval";

          const gotAllApprovals = await condition(
            () => result.toolCalls.every((tc) => pendingToolApprovals.has(tc.id)) || cancelled,
            "5 minutes",
          );

          if (!gotAllApprovals || cancelled) {
            finalStatus = cancelled ? "cancelled" : "timeout";
            pendingToolCallIds = [];
            break;
          }

          currentStatus = "running";

          // Execute approved tools in parallel
          const approvedCalls = result.toolCalls.filter((tc) => pendingToolApprovals.get(tc.id) === true);
          const rejectedCalls = result.toolCalls.filter((tc) => pendingToolApprovals.get(tc.id) !== true);

          const approvedResults = await Promise.all(
            approvedCalls.map((tc) =>
              executeToolCall(input.orgId, input.agentId!, tc.id, tc.name, tc.arguments)
            ),
          );

          for (let i = 0; i < approvedCalls.length; i++) {
            const tc = approvedCalls[i];
            const toolResult = approvedResults[i];
            const contextContent = toolResult.success
              ? `[${tc.name}] ${toolResult.summary}\n${JSON.stringify(toolResult.data)}`
              : `[${tc.name}] Error: ${toolResult.error}`;
            messageHistory.push({ role: "tool", content: contextContent });
            toolCallRecords.push({
              toolName: tc.name,
              input: JSON.parse(tc.arguments || "{}"),
              output: toolResult.data,
              error: toolResult.error,
              durationMs: 0,
            });
          }

          for (const tc of rejectedCalls) {
            messageHistory.push({
              role: "tool",
              content: `[${tc.name}] Rejected: Tool call rejected by user`,
            });
          }

          // Clean up approvals
          for (const tc of result.toolCalls) {
            pendingToolApprovals.delete(tc.id);
          }
          pendingToolCallIds = [];
        } else {
          // Auto mode: execute all tool calls in parallel
          const startTime = Date.now();
          const results = await Promise.all(
            result.toolCalls.map((tc) =>
              executeToolCall(input.orgId, input.agentId!, tc.id, tc.name, tc.arguments)
            ),
          );
          const durationMs = Date.now() - startTime;

          for (let i = 0; i < result.toolCalls.length; i++) {
            const tc = result.toolCalls[i];
            const toolResult = results[i];
            const contextContent = toolResult.success
              ? `[${tc.name}] ${toolResult.summary}\n${JSON.stringify(toolResult.data)}`
              : `[${tc.name}] Error: ${toolResult.error}`;
            messageHistory.push({ role: "tool", content: contextContent });
            toolCallRecords.push({
              toolName: tc.name,
              input: JSON.parse(tc.arguments || "{}"),
              output: toolResult.data,
              error: toolResult.error,
              durationMs,
            });
          }
        }

        // Self-reflection: inject reflection prompt after tool results (Phase 2.2)
        const lastToolResults = result.toolCalls
          .map((tc) => {
            const record = toolCallRecords.find((r) => r.toolName === tc.name);
            return `"${tc.name}": ${record?.error ? `Error - ${record.error}` : "success"}`;
          })
          .join(", ");
        messageHistory.push({
          role: "system",
          content: `[Reflect on previous step] Tools executed: ${lastToolResults}. Did these achieve the intended goal? What adjustment is needed for the next step?`,
        });

        if (finalStatus !== "completed") break;
        continue;
      }

      // No tool calls = agent is done
      if (result.finishReason === "stop") break;
    }

    if (cancelled) finalStatus = "cancelled";
    else if (currentStep >= maxSteps && finalStatus === "completed") finalStatus = "max_steps";
  };

  // Run agent loop with timeout
  try {
    await CancellationScope.withTimeout(timeoutSeconds * 1000, agentLoop);
  } catch (err: any) {
    if (err.name === "CancelledFailure" || err.message?.includes("timed out")) {
      finalStatus = cancelled ? "cancelled" : "timeout";
    } else {
      if (input.workflowId) {
        await updateWorkflowStatus(input.workflowId, "error", {
          errorMessage: err.message ?? String(err),
        });
      }
      throw err;
    }
  }

  } // end of sub-agent orchestration else block

  // Update workflow status in DB
  if (input.workflowId) {
    const fs = finalStatus as string;
    const dbStatus = fs === "max_steps" ? "completed" as const
      : fs === "awaiting_input" ? "waiting_input" as const
      : fs === "timeout" ? "timeout" as const
      : fs === "cancelled" ? "cancelled" as const
      : "completed" as const;
    await updateWorkflowStatus(input.workflowId, dbStatus, {
      output: { steps: currentStep, totalTokens, messageIds, terminalReason: finalStatus },
    });
  }

  // Save updated memory
  const memoryUpdates: Record<string, unknown> = {
    lastInteraction: new Date().toISOString(),
    lastConversationId: conversationId,
  };
  await saveAgentMemory(input.agentId!, input.orgId, agent.memoryScope, memoryUpdates, input.userId);

  // Send completion notification
  await notifyAgentCompletion(
    input.orgId,
    input.userId,
    input.agentId!,
    conversationId!,
    { steps: currentStep, totalTokens, messageIds },
  );

  return {
    conversationId: conversationId!,
    content: messageHistory.filter((m) => m.role === "assistant").map((m) => m.content).join("\n"),
    messageIds,
    totalTokens,
    steps: currentStep,
    status: finalStatus,
    toolCallRecords,
    plan,
  };
}
