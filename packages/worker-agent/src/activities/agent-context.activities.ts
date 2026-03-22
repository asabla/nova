import { openai } from "@nova/worker-shared/litellm";

export interface SummarizeContextInput {
  messages: { role: string; content: string }[];
  maxTokens: number;
  model: string;
}

/**
 * Summarize conversation context to stay within model limits.
 * Strategy: keep system messages + last N messages verbatim, summarize middle into "Previously: ..."
 */
export async function summarizeContext(
  input: SummarizeContextInput,
): Promise<{ role: string; content: string }[]> {
  const { messages, model } = input;

  if (messages.length <= 6) return messages;

  // Keep: system messages, first user message, last 4 messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  if (nonSystem.length <= 4) return messages;

  const firstMessage = nonSystem[0];
  const lastMessages = nonSystem.slice(-4);
  const middleMessages = nonSystem.slice(1, -4);

  if (middleMessages.length === 0) return messages;

  // Summarize the middle section
  const middleText = middleMessages
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Summarize the following conversation excerpt concisely. Focus on key decisions, tool results, and important context. Output a brief paragraph.",
        },
        { role: "user", content: middleText },
      ],
      temperature: 0,
      max_tokens: 500,
    } as any);

    const summary = (response as any).choices?.[0]?.message?.content ?? "";

    return [
      ...systemMessages,
      firstMessage,
      {
        role: "system",
        content: `Previously: ${summary}`,
      },
      ...lastMessages,
    ];
  } catch {
    // If summarization fails, just truncate middle messages
    return [
      ...systemMessages,
      firstMessage,
      {
        role: "system",
        content: `Previously: ${middleMessages.length} messages exchanged (summarization failed).`,
      },
      ...lastMessages,
    ];
  }
}
