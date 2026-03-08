import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton, MessageSkeleton, ConversationListSkeleton, CardSkeleton } from "@/components/ui/Skeleton";

const meta: Meta = {
  title: "Patterns/LoadingStates",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

/** Base skeleton element */
export const BaseSkeleton: Story = {
  render: () => (
    <div className="space-y-3 max-w-md">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-8 w-32 rounded-full" />
    </div>
  ),
};

/** Chat message skeleton */
export const MessageSkeletonStory: Story = {
  name: "Message Skeleton",
  render: () => (
    <div className="max-w-lg">
      <MessageSkeleton />
      <MessageSkeleton />
      <MessageSkeleton />
    </div>
  ),
};

/** Sidebar conversation list skeleton */
export const ConversationListSkeletonStory: Story = {
  name: "Conversation List Skeleton",
  render: () => (
    <div className="w-72 bg-surface border border-border rounded-xl p-2">
      <ConversationListSkeleton />
    </div>
  ),
};

/** Card skeleton (agents, knowledge, etc.) */
export const CardSkeletonStory: Story = {
  name: "Card Skeleton",
  render: () => (
    <div className="grid grid-cols-3 gap-4 max-w-2xl">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  ),
};

/** Chat view skeleton — full chat loading state */
export const ChatViewSkeleton: Story = {
  render: () => (
    <div className="max-w-2xl border border-border rounded-xl overflow-hidden bg-surface">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-5 w-16 rounded-full ml-auto" />
      </div>

      {/* Messages skeleton */}
      <div className="py-2">
        <MessageSkeleton />
        <MessageSkeleton />
        <MessageSkeleton />
        <MessageSkeleton />
      </div>

      {/* Input skeleton */}
      <div className="border-t border-border p-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  ),
};

/** Settings page skeleton */
export const SettingsSkeleton: Story = {
  render: () => (
    <div className="max-w-xl space-y-6">
      {/* Title */}
      <Skeleton className="h-6 w-40" />

      {/* Form fields */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-16 rounded-lg" />
      </div>
    </div>
  ),
};

/** Sidebar skeleton — full sidebar loading state */
export const SidebarSkeleton: Story = {
  render: () => (
    <div className="w-72 h-[500px] border border-border rounded-xl bg-surface flex flex-col">
      {/* Logo area */}
      <div className="p-4 border-b border-border">
        <Skeleton className="h-6 w-24" />
      </div>

      {/* New chat button */}
      <div className="p-3">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>

      {/* Section header */}
      <div className="px-3 py-2">
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Conversation list */}
      <div className="flex-1 px-2">
        <ConversationListSkeleton />
      </div>

      {/* User area */}
      <div className="p-3 border-t border-border flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  ),
};

/** All loading states gallery */
export const AllLoadingStates: Story = {
  render: () => (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
          Message Skeletons
        </p>
        <div className="max-w-lg">
          <MessageSkeleton />
          <MessageSkeleton />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
          Conversation List Skeleton
        </p>
        <div className="w-64">
          <ConversationListSkeleton />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
          Card Grid Skeleton
        </p>
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
          Base Skeleton Shapes
        </p>
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  ),
};
