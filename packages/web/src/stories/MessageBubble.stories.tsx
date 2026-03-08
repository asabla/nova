import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MessageBubble } from "@/components/chat/MessageBubble";

// ── Mock message factory ─────────────────────────────────────────────────

function createMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    conversationId: "conv-1",
    senderType: "user" as string,
    content: "Hello, how can you help me today?",
    createdAt: new Date().toISOString(),
    status: "delivered",
    ...overrides,
  };
}

const mockCallbacks = {
  onRate: fn(),
  onEdit: fn(),
  onEditAndRerun: fn(),
  onRerun: fn(),
  onNote: fn(),
  onFork: fn(),
};

// ── Meta ─────────────────────────────────────────────────────────────────

const meta: Meta<typeof MessageBubble> = {
  title: "Chat/MessageBubble",
  component: MessageBubble,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MessageBubble>;

// ── Individual stories ───────────────────────────────────────────────────

/** Basic user message */
export const UserMessage: Story = {
  args: {
    message: createMessage(),
    userName: "Alice",
    ...mockCallbacks,
  },
};

/** Basic assistant message with markdown */
export const AssistantMessage: Story = {
  args: {
    message: createMessage({
      senderType: "assistant",
      content:
        "I'd be happy to help! Here are a few things I can assist with:\n\n- **Code review** and debugging\n- Writing documentation\n- Answering technical questions\n\nWhat would you like to work on?",
      modelId: "claude-sonnet-4-20250514",
      tokenCountPrompt: 142,
      tokenCountCompletion: 58,
      costCents: 0.42,
    }),
    ...mockCallbacks,
  },
};

/** Assistant message with a code block */
export const WithCodeBlock: Story = {
  args: {
    message: createMessage({
      senderType: "assistant",
      content:
        'Here\'s a simple React component:\n\n```tsx\nimport { useState } from "react";\n\nexport function Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(c => c + 1)}>\n      Count: {count}\n    </button>\n  );\n}\n```\n\nThis uses the `useState` hook to manage state.',
      tokenCountPrompt: 200,
      tokenCountCompletion: 120,
    }),
    ...mockCallbacks,
  },
};

/** Streaming state with no content yet */
export const Streaming: Story = {
  args: {
    message: createMessage({
      senderType: "assistant",
      content: null,
      status: "streaming",
    }),
    ...mockCallbacks,
  },
};

/** Failed message */
export const Failed: Story = {
  args: {
    message: createMessage({
      senderType: "assistant",
      content: null,
      status: "failed",
    }),
    ...mockCallbacks,
  },
};

/** Edited message with history */
export const EditedMessage: Story = {
  args: {
    message: createMessage({
      isEdited: true,
      content: "Updated message content (v2)",
      editHistory: [
        { content: "Original message content", editedAt: new Date(Date.now() - 300_000).toISOString() },
      ],
    }),
    userName: "Alice",
    ...mockCallbacks,
  },
};

/** Message with file attachments */
export const WithAttachments: Story = {
  args: {
    message: createMessage({
      content: "Here are the files you requested",
      attachments: [
        {
          id: "att-1",
          fileId: "file-1",
          filename: "report.pdf",
          contentType: "application/pdf",
          sizeBytes: 2_450_000,
          attachmentType: "file",
        },
        {
          id: "att-2",
          fileId: "file-2",
          filename: "screenshot.png",
          contentType: "image/png",
          sizeBytes: 145_000,
          attachmentType: "image",
        },
        {
          id: "att-3",
          fileId: "file-3",
          filename: "data.csv",
          contentType: "text/csv",
          sizeBytes: 850,
          attachmentType: "file",
        },
      ],
    }),
    userName: "Alice",
    ...mockCallbacks,
  },
};

/** Assistant message with token/cost metadata visible */
export const WithMetadata: Story = {
  args: {
    message: createMessage({
      senderType: "assistant",
      content: "The capital of France is **Paris**.",
      modelId: "claude-sonnet-4-20250514",
      tokenCountPrompt: 42,
      tokenCountCompletion: 12,
      costCents: 0.08,
      rating: "up",
    }),
    ...mockCallbacks,
  },
};

/** Thumbs-down rated message */
export const RatedDown: Story = {
  args: {
    message: createMessage({
      senderType: "assistant",
      content: "I'm not sure about that. Let me try again.",
      rating: "down",
      tokenCountPrompt: 30,
      tokenCountCompletion: 15,
    }),
    ...mockCallbacks,
  },
};

/** Long user message */
export const LongUserMessage: Story = {
  args: {
    message: createMessage({
      content:
        "I'm working on a complex React application that uses TanStack Router for routing, Zustand for state management, and TanStack Query for server state. I've been running into an issue where my query invalidation doesn't seem to trigger re-renders in components that are subscribed to the query. I've checked the query keys and they match, and I've verified that the invalidation is actually being called. The cache appears to be updated but the component doesn't reflect the new data. Could you help me debug this? Here's the relevant code...",
    }),
    userName: "Bob",
    ...mockCallbacks,
  },
};

/** Gallery of all message variants */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
        User Message
      </p>
      <MessageBubble
        message={createMessage()}
        userName="Alice"
        {...mockCallbacks}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3 mt-6">
        Assistant Message
      </p>
      <MessageBubble
        message={createMessage({
          senderType: "assistant",
          content: "Here's a helpful response with **markdown** and `inline code`.",
          tokenCountPrompt: 50,
          tokenCountCompletion: 20,
          costCents: 0.15,
        })}
        {...mockCallbacks}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3 mt-6">
        Streaming
      </p>
      <MessageBubble
        message={createMessage({
          senderType: "assistant",
          content: null,
          status: "streaming",
        })}
        {...mockCallbacks}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3 mt-6">
        Failed
      </p>
      <MessageBubble
        message={createMessage({
          senderType: "assistant",
          content: null,
          status: "failed",
        })}
        {...mockCallbacks}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3 mt-6">
        With Attachments
      </p>
      <MessageBubble
        message={createMessage({
          content: "Check out these files",
          attachments: [
            { id: "a1", fileId: "f1", filename: "notes.md", contentType: "text/markdown", sizeBytes: 4200, attachmentType: "file" },
            { id: "a2", fileId: "f2", filename: "photo.jpg", contentType: "image/jpeg", sizeBytes: 1_200_000, attachmentType: "image" },
          ],
        })}
        userName="Alice"
        {...mockCallbacks}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3 mt-6">
        Rated Response
      </p>
      <MessageBubble
        message={createMessage({
          senderType: "assistant",
          content: "A well-received answer.",
          rating: "up",
          tokenCountPrompt: 30,
          tokenCountCompletion: 10,
        })}
        {...mockCallbacks}
      />
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
