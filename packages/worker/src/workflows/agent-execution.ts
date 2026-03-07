import { proxyActivities, defineSignal, setHandler, sleep } from "@temporalio/workflow";
import type * as agentActivities from "../activities/agent-execution.activities";

const {
  getAgentConfig,
  loadAgentMemory,
  saveAgentMemory,
  executeAgentStep,
  saveAgentMessage,
  createAgentConversation,
  executeToolCall,
  notifyAgentCompletion,
} = proxyActivities<typeof agentActivities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 },
});

export interface AgentExecutionInput {
  orgId: string;
  userId: string;
  agentId: string;
  conversationId?: string;
  userMessage: string;
  maxSteps?: number;
}

export interface AgentExecutionResult {
  conversationId: string;
  messageIds: string[];
  totalTokens: number;
  steps: number;
}

export const cancelSignal = defineSignal("cancel");

export async function agentExecutionWorkflow(input: AgentExecutionInput): Promise<AgentExecutionResult> {
  const maxSteps = input.maxSteps ?? 10;
  let cancelled = false;
  setHandler(cancelSignal, () => { cancelled = true; });

  // 1. Load agent config
  const agent = await getAgentConfig(input.orgId, input.agentId);

  // 2. Load agent memory
  const memory = await loadAgentMemory(
    input.agentId,
    agent.memoryScope,
    agent.memoryScope === "per-user" ? input.userId : undefined,
  );

  // 3. Create or use conversation
  let conversationId = input.conversationId;
  if (!conversationId) {
    const conv = await createAgentConversation(
      input.orgId,
      input.userId,
      input.agentId,
      `Agent: ${agent.name}`,
    );
    conversationId = conv.id;
  }

  // 4. Build initial message history
  const messageHistory: { role: string; content: string }[] = [];

  // Add memory context
  if (Object.keys(memory).length > 0) {
    messageHistory.push({
      role: "system",
      content: `Agent memory:\n${JSON.stringify(memory, null, 2)}`,
    });
  }

  messageHistory.push({ role: "user", content: input.userMessage });

  // 5. Agent loop
  const messageIds: string[] = [];
  let totalTokens = 0;
  let step = 0;

  while (step < maxSteps && !cancelled) {
    step++;

    const result = await executeAgentStep(
      {
        systemPrompt: agent.systemPrompt,
        modelId: agent.modelId,
        modelParams: agent.modelParams,
      },
      messageHistory,
      [], // Tools will be loaded from agent config in production
      step,
    );

    totalTokens += (result.usage.prompt_tokens ?? 0) + (result.usage.completion_tokens ?? 0);

    // Save assistant message
    if (result.content) {
      const msg = await saveAgentMessage(
        input.orgId,
        conversationId,
        result.content,
        input.agentId,
        agent.modelId,
        result.usage.prompt_tokens,
        result.usage.completion_tokens,
      );
      messageIds.push(msg.id);
      messageHistory.push({ role: "assistant", content: result.content });
    }

    // Handle tool calls
    if (result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        const toolResult = await executeToolCall(
          input.orgId,
          input.agentId,
          toolCall.id,
          toolCall.function?.name ?? "unknown",
          toolCall.function?.arguments ?? "{}",
        );
        messageHistory.push({
          role: "tool",
          content: JSON.stringify(toolResult),
        });
      }
      continue; // Re-run the agent with tool results
    }

    // No tool calls = agent is done
    if (result.finishReason === "stop") break;
  }

  // 6. Save updated memory
  const memoryUpdates: Record<string, unknown> = {
    lastInteraction: new Date().toISOString(),
    lastConversationId: conversationId,
  };
  await saveAgentMemory(input.agentId, input.orgId, agent.memoryScope, memoryUpdates, input.userId);

  // 7. Send completion notification (Story #164)
  await notifyAgentCompletion(
    input.orgId,
    input.userId,
    input.agentId,
    conversationId,
    { steps: step, totalTokens, messageIds },
  );

  return {
    conversationId,
    messageIds,
    totalTokens,
    steps: step,
  };
}
