/**
 * Pure helpers for the rerun / edit-and-rerun flows.
 *
 * The "anchor" is the last message we want to keep when re-running — i.e. the
 * user turn that produced (or should produce) the new response. Everything
 * after the anchor is soft-deleted via the truncate-after endpoint so the
 * old response disappears from view before the new one streams in.
 */

export interface RerunMessage {
  id: string;
  parentMessageId?: string | null;
  senderType: "user" | "assistant" | string;
  content?: string | null;
  createdAt?: string;
}

export interface RerunPlan {
  /** Message id whose children should be truncated. */
  anchorId: string;
  /** Messages to include as history (up to and including the anchor). */
  history: RerunMessage[];
  /** parentMessageId to pass to the stream endpoint — always the anchor. */
  parentMessageId: string;
}

/**
 * Compute the rerun plan for re-running a message. Returns null when the
 * target can't be rerun (not found, or assistant message with no parent).
 */
export function computeRerunPlan(
  messages: RerunMessage[],
  messageId: string,
): RerunPlan | null {
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return null;

  const anchorId = msg.senderType === "assistant" ? msg.parentMessageId : messageId;
  if (!anchorId) return null;

  const anchorIdx = messages.findIndex((m) => m.id === anchorId);
  if (anchorIdx < 0) return null;

  return {
    anchorId,
    history: messages.slice(0, anchorIdx + 1),
    parentMessageId: anchorId,
  };
}

/**
 * Compute the plan for edit-and-rerun: the target user message is edited
 * in place; everything after it is truncated; history stops just before it
 * (the replacement content is appended by the caller).
 */
export function computeEditAndRerunPlan(
  messages: RerunMessage[],
  messageId: string,
): RerunPlan | null {
  const msg = messages.find((m) => m.id === messageId);
  if (!msg || msg.senderType !== "user") return null;

  const idx = messages.indexOf(msg);
  return {
    anchorId: messageId,
    history: messages.slice(0, idx),
    parentMessageId: messageId,
  };
}
