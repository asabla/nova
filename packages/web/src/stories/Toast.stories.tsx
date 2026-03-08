import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast, ToastContainer } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Components/Toast",
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <ToastContainer />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const Success: Story = {
  render: () => (
    <Button onClick={() => toast.success("Changes saved successfully!")}>
      Show Success Toast
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button variant="danger" onClick={() => toast.error("Failed to delete conversation")}>
      Show Error Toast
    </Button>
  ),
};

export const Warning: Story = {
  render: () => (
    <Button variant="secondary" onClick={() => toast.warning("Rate limit approaching — slow down requests")}>
      Show Warning Toast
    </Button>
  ),
};

export const Info: Story = {
  render: () => (
    <Button variant="ghost" onClick={() => toast.info("New model available: GPT-4o-mini")}>
      Show Info Toast
    </Button>
  ),
};

/** Trigger all toast types to see them stacked */
export const AllTypes: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Click to trigger each type</p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => toast.success("Operation completed successfully!")}>
            Success
          </Button>
          <Button size="sm" variant="danger" onClick={() => toast.error("Something went wrong. Please try again.")}>
            Error
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast.warning("API quota is at 80% usage")}>
            Warning
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toast.info("Tip: Press Ctrl+K to open the command palette")}>
            Info
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Stack Multiple</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            toast.success("File uploaded");
            setTimeout(() => toast.info("Processing document..."), 300);
            setTimeout(() => toast.success("Document indexed"), 800);
          }}
        >
          Trigger 3 Toasts
        </Button>
      </div>
    </div>
  ),
};
