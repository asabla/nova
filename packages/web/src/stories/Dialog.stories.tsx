import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Dialog width",
    },
    title: { control: "text" },
    open: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

function DialogDemo({ size, title, children }: { size?: "sm" | "md" | "lg"; title?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} size={size}>
        {children || (
          <p className="text-sm text-text-secondary">
            This is a dialog content area. You can place any content here including forms, confirmations, or detailed views.
          </p>
        )}
      </Dialog>
    </>
  );
}

export const Default: Story = {
  render: () => <DialogDemo title="Dialog Title" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openButton = canvas.getByRole("button", { name: "Open Dialog" });
    await userEvent.click(openButton);
    // Dialog renders in a portal, so query from document body
    await expect(document.body.querySelector("[role='dialog']")).not.toBeNull();
  },
};

export const Small: Story = {
  render: () => (
    <DialogDemo size="sm" title="Confirm Action">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Are you sure you want to delete this conversation? This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm">Cancel</Button>
          <Button variant="danger" size="sm">Delete</Button>
        </div>
      </div>
    </DialogDemo>
  ),
};

export const Large: Story = {
  render: () => (
    <DialogDemo size="lg" title="Create New Agent">
      <div className="space-y-4">
        <Input label="Agent Name" placeholder="My Assistant" />
        <Input label="System Prompt" placeholder="You are a helpful assistant..." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Temperature" type="number" placeholder="0.7" />
          <Input label="Max Tokens" type="number" placeholder="4096" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost">Cancel</Button>
          <Button>Create Agent</Button>
        </div>
      </div>
    </DialogDemo>
  ),
};

export const NoTitle: Story = {
  render: () => (
    <DialogDemo>
      <div className="text-center space-y-4 py-4">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-text">Successfully Created!</p>
          <p className="text-sm text-text-secondary mt-1">Your new workspace is ready to use.</p>
        </div>
        <Button size="sm">Got it</Button>
      </div>
    </DialogDemo>
  ),
};

/** Showcases all dialog sizes and use cases */
export const AllSizes: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Dialog Sizes</p>
        <div className="flex items-center gap-3">
          <DialogDemo size="sm" title="Small Dialog">
            <p className="text-sm text-text-secondary">Compact dialog for confirmations.</p>
          </DialogDemo>
          <DialogDemo size="md" title="Medium Dialog">
            <p className="text-sm text-text-secondary">Standard dialog for most content.</p>
          </DialogDemo>
          <DialogDemo size="lg" title="Large Dialog">
            <p className="text-sm text-text-secondary">Large dialog for complex forms and detailed content.</p>
          </DialogDemo>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Common Patterns</p>
        <div className="flex items-center gap-3">
          <DialogDemo size="sm" title="Delete Conversation?">
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">This will permanently delete the conversation and all messages.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm">Cancel</Button>
                <Button variant="danger" size="sm">Delete</Button>
              </div>
            </div>
          </DialogDemo>
          <DialogDemo size="md" title="New Workspace">
            <div className="space-y-4">
              <Input label="Workspace Name" placeholder="Engineering" />
              <Input label="Description" placeholder="Team workspace for..." />
              <div className="flex justify-end gap-2">
                <Button variant="ghost">Cancel</Button>
                <Button>Create</Button>
              </div>
            </div>
          </DialogDemo>
        </div>
      </div>
    </div>
  ),
};
