import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ConversationHeader } from "@/components/chat/ConversationHeader";

/**
 * Minimal router context — ConversationHeader uses useNavigate()
 * for fork/archive/delete navigation.
 */
const rootRoute = createRootRoute({ component: () => null });
const memoryHistory = createMemoryHistory({ initialEntries: ["/conversations/conv-1"] });
const router = createRouter({
  routeTree: rootRoute,
  history: memoryHistory,
});

// ── Mock conversation data ───────────────────────────────────────────────

const baseConversation = {
  id: "conv-1",
  title: "How to implement RAG with embeddings",
  model: "claude-sonnet-4-20250514",
  isPinned: false,
  totalTokens: 4580,
  estimatedCostCents: 2.3,
  createdAt: new Date().toISOString(),
};

const pinnedConversation = {
  ...baseConversation,
  id: "conv-2",
  title: "Project Architecture Overview",
  isPinned: true,
  totalTokens: 12800,
  estimatedCostCents: 6.4,
};

const untitledConversation = {
  ...baseConversation,
  id: "conv-3",
  title: null,
  totalTokens: 0,
  estimatedCostCents: 0,
};

const meta: Meta = {
  title: "Chat/ConversationHeader",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      // @ts-expect-error — simplified router for storybook
      <RouterProvider router={router}>
        <div style={{ maxWidth: 700, width: "100%" }}>
          <Story />
        </div>
      </RouterProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** Default header with title, model badge, and token count */
export const Default: Story = {
  render: () => <ConversationHeader conversation={baseConversation} />,
};

/** Pinned conversation with pin icon */
export const Pinned: Story = {
  render: () => <ConversationHeader conversation={pinnedConversation} />,
};

/** Untitled conversation */
export const Untitled: Story = {
  render: () => <ConversationHeader conversation={untitledConversation} />,
};

/** All header variants */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Default
      </p>
      <ConversationHeader conversation={baseConversation} />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Pinned
      </p>
      <ConversationHeader conversation={pinnedConversation} />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Untitled
      </p>
      <ConversationHeader conversation={untitledConversation} />
    </div>
  ),
};
