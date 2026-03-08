import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Skeleton,
  MessageSkeleton,
  ConversationListSkeleton,
  CardSkeleton,
} from "@/components/ui/Skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Components/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const BasicSkeleton: Story = {
  args: {
    className: "h-4 w-48",
  },
};

export const Message: Story = {
  render: () => <MessageSkeleton />,
};

export const ConversationList: Story = {
  render: () => (
    <div className="w-64">
      <ConversationListSkeleton />
    </div>
  ),
};

export const Card: Story = {
  render: () => (
    <div className="w-64">
      <CardSkeleton />
    </div>
  ),
};

/** Showcases all skeleton loading patterns */
export const AllPatterns: Story = {
  render: () => (
    <div className="space-y-10 max-w-2xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Primitive Shapes</p>
        <div className="space-y-3">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Message Loading</p>
        <div className="space-y-1 bg-surface-secondary rounded-xl border border-border p-2">
          <MessageSkeleton />
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Sidebar Loading</p>
        <div className="w-64 bg-surface-secondary rounded-xl border border-border p-2">
          <ConversationListSkeleton />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Card Grid Loading</p>
        <div className="grid grid-cols-3 gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  ),
};
