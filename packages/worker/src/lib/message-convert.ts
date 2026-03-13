import type { AgentInputItem } from "@openai/agents";

/**
 * Convert simple {role, content} message history to the Agent SDK's
 * protocol-based AgentInputItem format.
 *
 * The SDK expects typed items:
 * - system: { role: "system", content: string }
 * - user: { role: "user", content: string | [{type: "input_text", text}] }
 * - assistant: { role: "assistant", status: "completed", content: [{type: "output_text", text}] }
 * - tool: mapped to function call result items (skipped here — handled by SDK)
 */
export function toAgentInput(
  messages: { role: string; content: string; [k: string]: unknown }[],
): AgentInputItem[] {
  const items: AgentInputItem[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        items.push({
          role: "system",
          content: msg.content,
        } as AgentInputItem);
        break;

      case "user":
        items.push({
          role: "user",
          content: msg.content,
        } as AgentInputItem);
        break;

      case "assistant":
        items.push({
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: msg.content }],
        } as AgentInputItem);
        break;

      case "tool":
        // Tool results are represented as function call output items in the protocol.
        // The SDK's ChatCompletions model adapter handles the conversion internally,
        // so we pass these through with providerData for the adapter to pick up.
        items.push({
          role: "user",
          content: [{ type: "input_text", text: `[Tool result: ${msg.content}]` }],
        } as AgentInputItem);
        break;

      default:
        // Unknown role — pass as user message
        items.push({
          role: "user",
          content: msg.content,
        } as AgentInputItem);
        break;
    }
  }

  return items;
}
