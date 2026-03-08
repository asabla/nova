import type { Meta, StoryObj } from "@storybook/react-vite";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

const meta: Meta<typeof TypingIndicator> = {
  title: "Chat/TypingIndicator",
  component: TypingIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof TypingIndicator>;

export const SingleUser: Story = {
  args: {
    typingUsers: [{ name: "NOVA" }],
  },
};

export const TwoUsers: Story = {
  args: {
    typingUsers: [{ name: "Alice" }, { name: "Bob" }],
  },
};

export const MultipleUsers: Story = {
  args: {
    typingUsers: [{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }],
  },
};

/** Showcases the typing indicator in context */
export const InContext: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">AI Assistant Typing</p>
        <div className="p-3 rounded-xl bg-surface-secondary border border-border">
          <div className="text-sm text-text mb-2 px-4 py-2">What's the best way to handle errors in async TypeScript?</div>
          <TypingIndicator typingUsers={[{ name: "NOVA" }]} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Multiple Team Members</p>
        <div className="p-3 rounded-xl bg-surface-secondary border border-border">
          <TypingIndicator typingUsers={[{ name: "Alex Kim" }, { name: "Sarah Chen" }]} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Crowd Typing</p>
        <div className="p-3 rounded-xl bg-surface-secondary border border-border">
          <TypingIndicator
            typingUsers={[
              { name: "Alice" },
              { name: "Bob" },
              { name: "Carol" },
              { name: "David" },
            ]}
          />
        </div>
      </div>
    </div>
  ),
};
