export type SSEEvent =
  | { event: "token"; data: { content: string } }
  | { event: "tool_call"; data: { id: string; name: string; arguments: string } }
  | { event: "tool_result"; data: { id: string; result: unknown } }
  | { event: "approval_required"; data: { toolCallId: string; name: string; args: unknown } }
  | { event: "error"; data: { message: string; code: string } }
  | { event: "done"; data: "" }
  | { event: "heartbeat"; data: "" };
