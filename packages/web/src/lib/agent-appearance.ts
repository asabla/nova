/**
 * Agent appearance utilities — derives a unique icon color from agent identity.
 * Uses the existing `avatarUrl` field: if it contains `color:<hex>`, we parse it.
 * Otherwise, a color is generated deterministically from the agent name/id.
 */

// Curated palette of 12 distinct, vibrant colors that work on dark backgrounds
const AGENT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Parse a stored color from the avatarUrl field.
 * Convention: `color:<hex>` stores a user-chosen color.
 * Anything else (or empty) falls back to deterministic hash.
 */
export function parseAgentColor(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const match = avatarUrl.match(/^color:(#[0-9a-fA-F]{6})$/);
  return match ? match[1] : null;
}

/**
 * Get the display color for an agent. Uses stored color if present,
 * otherwise derives one deterministically from the agent's name or id.
 */
export function getAgentColor(agent: { id?: string; name?: string; avatarUrl?: string | null }): string {
  const stored = parseAgentColor(agent.avatarUrl);
  if (stored) return stored;
  const seed = agent.name || agent.id || "agent";
  return AGENT_COLORS[hashString(seed) % AGENT_COLORS.length];
}

/**
 * Build a `bg-[color]/10` style for an agent's icon background.
 */
export function getAgentBgStyle(color: string): React.CSSProperties {
  return { backgroundColor: `${color}15` };
}

/**
 * Build an icon color style.
 */
export function getAgentIconStyle(color: string): React.CSSProperties {
  return { color };
}

export { AGENT_COLORS };
