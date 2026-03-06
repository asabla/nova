import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { User, Bot } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import { Avatar } from "../ui/Avatar";

// ---- Types -----------------------------------------------------------------

export interface MentionCandidate {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  /** "user" or "agent" */
  kind: "user" | "agent";
}

interface MentionPopupProps {
  /** The current text after the `@` trigger (e.g. "joh" when user typed "@joh") */
  query: string;
  /** Pixel position for the popup (absolute within the parent) */
  position: { top: number; left: number };
  /** Called when a candidate is selected */
  onSelect: (candidate: MentionCandidate) => void;
  /** Called when the popup should close (Escape, click-away) */
  onClose: () => void;
  /** Whether the popup is visible */
  visible: boolean;
  /** Optional conversation ID for the dedicated mentionables endpoint */
  conversationId?: string;
}

// ---- Component -------------------------------------------------------------

export function MentionPopup({
  query,
  position,
  onSelect,
  onClose,
  visible,
  conversationId,
}: MentionPopupProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // If a conversationId is provided, use the dedicated mentionables endpoint.
  // Otherwise fall back to fetching users + agents separately.
  const { data: mentionablesData } = useQuery({
    queryKey: ["mentionables", conversationId],
    queryFn: () =>
      api.get<{ data: MentionCandidate[] }>(
        `/api/conversations/${conversationId}/mentionables`,
      ),
    enabled: visible && !!conversationId,
    staleTime: 60_000,
  });

  const { data: usersData } = useQuery({
    queryKey: ["mention-candidates", "users"],
    queryFn: () =>
      api.get<{ data: Array<{ id: string; name: string; username?: string; image?: string }> }>(
        "/api/users?limit=50",
      ),
    enabled: visible && !conversationId,
    staleTime: 60_000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["mention-candidates", "agents"],
    queryFn: () =>
      api.get<{ data: Array<{ id: string; name: string; slug?: string; avatarUrl?: string }> }>(
        "/api/agents?limit=50",
      ),
    enabled: visible && !conversationId,
    staleTime: 60_000,
  });

  // Build unified candidate list
  const allCandidates: MentionCandidate[] = useMemo(() => {
    // Use the dedicated endpoint if available
    if (conversationId && mentionablesData?.data) {
      return mentionablesData.data;
    }

    // Fallback: merge users + agents
    const usersList: MentionCandidate[] = (usersData?.data ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username ?? u.name.toLowerCase().replace(/\s+/g, "."),
      avatarUrl: u.image,
      kind: "user" as const,
    }));

    const agentsList: MentionCandidate[] = (agentsData?.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      username: a.slug ?? a.name.toLowerCase().replace(/\s+/g, "-"),
      avatarUrl: a.avatarUrl,
      kind: "agent" as const,
    }));

    return [...usersList, ...agentsList];
  }, [conversationId, mentionablesData, usersData, agentsData]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query) return allCandidates.slice(0, 8);
    const q = query.toLowerCase();
    return allCandidates
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [allCandidates, query]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length, query]);

  // Keyboard navigation (capture phase so it fires before the textarea handler)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % filtered.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          e.stopPropagation();
          onSelect(filtered[activeIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [visible, filtered, activeIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!visible) return null;

  return (
    <div
      className={clsx(
        "absolute z-50 w-64 rounded-xl border border-border bg-surface shadow-lg overflow-hidden",
        "animate-in fade-in zoom-in-95 duration-100",
      )}
      style={{ bottom: "100%", left: position.left, marginBottom: 8 }}
      role="listbox"
      aria-label={t("mentions.popup", { defaultValue: "Mention someone" })}
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-text-tertiary">
          {t("mentions.noResults", { defaultValue: "No users or agents found" })}
        </div>
      ) : (
        <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
          {filtered.map((candidate, index) => {
            const isActive = index === activeIndex;
            const KindIcon = candidate.kind === "agent" ? Bot : User;

            return (
              <button
                key={`${candidate.kind}-${candidate.id}`}
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(candidate)}
                onMouseEnter={() => setActiveIndex(index)}
                className={clsx(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  isActive ? "bg-primary/10" : "hover:bg-surface-secondary",
                )}
              >
                <Avatar
                  name={candidate.name}
                  src={candidate.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text font-medium truncate">
                    {candidate.name}
                  </p>
                  <p className="text-xs text-text-tertiary truncate">
                    @{candidate.username}
                  </p>
                </div>
                <KindIcon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Helper hook for integrating with MessageInput -------------------------

/**
 * Tracks `@` trigger inside a textarea value and provides state for the
 * MentionPopup.
 *
 * Usage:
 * ```tsx
 * const mention = useMentionTrigger(content, textareaRef);
 * // Render <MentionPopup {...mention.popupProps} onSelect={...} />
 * ```
 */
export function useMentionTrigger(
  value: string,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [trigger, setTrigger] = useState<{
    query: string;
    position: { top: number; left: number };
    startIndex: number;
  } | null>(null);

  const update = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart;
    const textBefore = value.slice(0, cursor);

    // Find the last unmatched `@` (preceded by whitespace or at start of string)
    const match = textBefore.match(/(^|[\s])@([^\s]*)$/);

    if (!match) {
      setTrigger(null);
      return;
    }

    const query = match[2];
    const startIndex = cursor - query.length - 1; // -1 for the @ char

    // Position the popup. Since the parent container now has `position: relative`,
    // we use `bottom: 100%` in the popup styles and just pass left offset.
    const rect = textarea.getBoundingClientRect();
    const parentRect = textarea.offsetParent?.getBoundingClientRect() ?? rect;

    setTrigger({
      query,
      position: {
        top: rect.top - parentRect.top - 8, // kept for reference, popup uses bottom: 100%
        left: Math.min(rect.left - parentRect.left + 16, 200),
      },
      startIndex,
    });
  }, [value, textareaRef]);

  // Re-evaluate on value changes
  useEffect(() => {
    update();
  }, [update]);

  const handleSelect = useCallback(
    (candidate: MentionCandidate): string => {
      if (!trigger) return value;
      // Replace @query with @username and add a trailing space
      const before = value.slice(0, trigger.startIndex);
      const after = value.slice(trigger.startIndex + 1 + trigger.query.length);
      const newValue = `${before}@${candidate.username} ${after}`;
      setTrigger(null);
      return newValue;
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
