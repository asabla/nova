export interface ThinkParseResult {
  visibleContent: string;
  thinkingContent: string;
  isThinking: boolean;
  hasThinkingContent: boolean;
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

/**
 * Parse `<think>...</think>` blocks from LLM output.
 *
 * - Handles properly closed blocks, unclosed blocks (streaming), and the
 *   double-opener pattern where models use `<think>` as both opener and closer.
 * - Buffers partial tags at the end of the string so they don't flash as raw text.
 * - Single linear scan — no regex in the hot path.
 *
 * Double-opener model pattern: `<think>A<think>B<think>C<think>actual answer`
 * All content until the last `<think>` boundary is thinking. Only `</think>` or
 * end-of-input (for completed messages) exits thinking mode.
 */
export function parseThinkBlocks(raw: string): ThinkParseResult {
  let visible = "";
  let thinking = "";
  let insideThink = false;
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "<") {
      // Check for <think>
      if (raw.startsWith(THINK_OPEN, i)) {
        if (!insideThink) {
          insideThink = true;
        }
        // If already inside thinking, <think> is a no-op (stay in thinking).
        // This prevents alternating blocks from leaking as visible content
        // when models emit multiple <think> tags without </think>.
        i += THINK_OPEN.length;
        continue;
      }

      // Check for </think>
      if (raw.startsWith(THINK_CLOSE, i)) {
        insideThink = false;
        i += THINK_CLOSE.length;
        continue;
      }

      // Check for partial tag at the very end of the string
      const remaining = raw.length - i;
      if (remaining < THINK_CLOSE.length) {
        const tail = raw.slice(i);
        if (THINK_OPEN.startsWith(tail) || THINK_CLOSE.startsWith(tail)) {
          // Hold back — could be a partial tag still arriving
          break;
        }
      }

      // Regular `<` character — pass through
      if (insideThink) {
        thinking += raw[i];
      } else {
        visible += raw[i];
      }
      i++;
    } else {
      if (insideThink) {
        thinking += raw[i];
      } else {
        visible += raw[i];
      }
      i++;
    }
  }

  return {
    visibleContent: visible,
    thinkingContent: thinking,
    isThinking: insideThink,
    hasThinkingContent: thinking.length > 0,
  };
}

/**
 * Parse think blocks for completed (non-streaming) messages.
 *
 * Same as `parseThinkBlocks`, but if the result still has an unclosed think block
 * (double-opener model pattern with no `</think>`), falls back to treating content
 * after the last `<think>` as visible — since the message is complete, the model
 * must have finished thinking.
 */
export function parseThinkBlocksComplete(raw: string): ThinkParseResult {
  const result = parseThinkBlocks(raw);

  if (result.isThinking && result.visibleContent === "") {
    // Double-opener pattern with no </think>: content after the last <think> is the answer
    const lastOpen = raw.lastIndexOf(THINK_OPEN);
    if (lastOpen !== -1) {
      const afterLast = raw.slice(lastOpen + THINK_OPEN.length);
      const beforeLast = raw.slice(0, lastOpen);
      // Collect all thinking from blocks before the last <think>
      const prior = parseThinkBlocks(beforeLast + THINK_CLOSE);
      return {
        visibleContent: afterLast,
        thinkingContent: prior.thinkingContent,
        isThinking: false,
        hasThinkingContent: prior.hasThinkingContent,
      };
    }
  }

  return result;
}
