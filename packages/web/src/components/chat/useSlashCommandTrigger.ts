import { useState, useEffect, useCallback } from "react";
import { isClientOnlySlashCommand } from "./SlashCommand";

/**
 * Tracks `/` trigger at the start of a textarea value and provides state
 * for the SlashCommand popup.
 *
 * Usage:
 * ```tsx
 * const slash = useSlashCommandTrigger(content, textareaRef);
 * // Render <SlashCommand {...slash.popupProps} onSelect={...} />
 * ```
 */
export function useSlashCommandTrigger(
  value: string,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [trigger, setTrigger] = useState<{
    query: string;
    position: { top: number; left: number };
  } | null>(null);

  const update = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Only trigger when the entire content is a single slash-command word
    // e.g. "/", "/mo", "/model" — but NOT "/model gpt-4" or "hello /model"
    const match = value.match(/^\/(\S*)$/);

    if (!match) {
      setTrigger(null);
      return;
    }

    const query = match[1]; // text after the slash

    // Position the popup above the input (same approach as useMentionTrigger)
    const rect = textarea.getBoundingClientRect();
    const parentRect = textarea.offsetParent?.getBoundingClientRect() ?? rect;

    setTrigger({
      query,
      position: {
        top: rect.top - parentRect.top - 8,
        left: Math.min(rect.left - parentRect.left + 16, 200),
      },
    });
  }, [value, textareaRef]);

  // Re-evaluate on value changes
  useEffect(() => {
    update();
  }, [update]);

  const handleSelect = useCallback(
    (command: string): string => {
      if (!trigger) return value;

      // Client-only commands return empty string — caller handles execution
      if (isClientOnlySlashCommand(command)) {
        setTrigger(null);
        return "";
      }

      // Server-side commands: replace content with command + trailing space
      setTrigger(null);
      return `${command} `;
    },
    [trigger, value],
  );

  const close = useCallback(() => setTrigger(null), []);

  return {
    active: trigger !== null,
    popupProps: {
      query: trigger?.query ?? "",
      position: trigger?.position ?? { top: 0, left: 0 },
      visible: trigger !== null,
      onClose: close,
    },
    handleSelect,
  };
}
