import { create } from "zustand";

interface Message {
  id: string;
  parentMessageId?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

interface BranchState {
  /** conversationId → { parentMessageId → activeChildId } */
  activeChildren: Record<string, Record<string, string>>;
  setActiveChild: (conversationId: string, parentId: string, childId: string) => void;
  clearConversation: (conversationId: string) => void;
}

const STORAGE_KEY = "nova:branch-state";

function loadState(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: Record<string, Record<string, string>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export const useBranchStore = create<BranchState>((set) => ({
  activeChildren: loadState(),

  setActiveChild: (conversationId, parentId, childId) => {
    set((state) => {
      const updated = {
        ...state.activeChildren,
        [conversationId]: {
          ...state.activeChildren[conversationId],
          [parentId]: childId,
        },
      };
      saveState(updated);
      return { activeChildren: updated };
    });
  },

  clearConversation: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.activeChildren;
      saveState(rest);
      return { activeChildren: rest };
    });
  },
}));

/**
 * Compute the active linear path through the message tree.
 *
 * Messages form a tree via parentMessageId. At each node, if there are
 * multiple children (siblings), the active one is chosen from the branch
 * store (defaulting to the most recently created sibling).
 *
 * Returns a flat array representing the single active path from root to leaf.
 */
export function getActivePath(
  conversationId: string,
  messages: Message[],
  activeChildren: Record<string, Record<string, string>>,
): Message[] {
  if (messages.length === 0) return [];

  const convPrefs = activeChildren[conversationId] ?? {};

  // Group children by parentMessageId
  const childrenOf = new Map<string, Message[]>();
  const roots: Message[] = [];

  for (const msg of messages) {
    if (!msg.parentMessageId) {
      roots.push(msg);
    } else {
      if (!childrenOf.has(msg.parentMessageId)) childrenOf.set(msg.parentMessageId, []);
      childrenOf.get(msg.parentMessageId)!.push(msg);
    }
  }

  // Sort children by createdAt within each group
  for (const children of childrenOf.values()) {
    children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Also handle root-level siblings (multiple root messages = branches of first message)
  // In practice there should be one root, but handle gracefully
  roots.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Walk the tree from root, picking the active child at each branch point
  const path: Message[] = [];

  // Start with the first root (or active root if there are root siblings)
  let current: Message | undefined = roots[roots.length - 1]; // default: most recent root
  if (!current) return [];

  path.push(current);

  while (current) {
    const children = childrenOf.get(current.id);
    if (!children || children.length === 0) break;

    // Pick active child: from store preference, or default to most recent
    const preferred = convPrefs[current.id];
    const active = (preferred && children.find((c) => c.id === preferred))
      ?? children[children.length - 1]; // default: most recent

    path.push(active);
    current = active;
  }

  return path;
}
