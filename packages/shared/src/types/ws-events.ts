export type ClientWSEvent =
  | { type: "typing.start"; conversationId: string }
  | { type: "typing.stop"; conversationId: string }
  | { type: "presence.ping" };

export type ServerWSEvent =
  | { type: "typing.start"; conversationId: string; userId: string }
  | { type: "typing.stop"; conversationId: string; userId: string }
  | { type: "presence.online"; userId: string }
  | { type: "presence.offline"; userId: string }
  | { type: "message.new"; conversationId: string; messageId: string }
  | { type: "conversation.updated"; conversationId: string }
  | { type: "notification.new"; id: string; notificationType: string; title: string; body: string }
  | { type: "workflow.progress"; workflowId: string; progress: unknown };
