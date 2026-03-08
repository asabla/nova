import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert, AlertTitle, AlertDescription, AlertActions } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Shield } from "lucide-react";

const meta: Meta<typeof Alert> = {
  title: "Components/Alert",
  component: Alert,
  argTypes: {
    variant: { control: "select", options: ["info", "success", "warning", "danger"] },
    dismissible: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  render: () => (
    <div className="w-96">
      <Alert variant="info">
        <AlertTitle>New models available</AlertTitle>
        <AlertDescription>Claude 4 Opus and Sonnet are now available in your workspace.</AlertDescription>
      </Alert>
    </div>
  ),
};

export const Success: Story = {
  render: () => (
    <div className="w-96">
      <Alert variant="success">
        <AlertTitle>Knowledge base indexed</AlertTitle>
        <AlertDescription>All 247 documents have been processed and are ready for retrieval.</AlertDescription>
      </Alert>
    </div>
  ),
};

export const Warning: Story = {
  render: () => (
    <div className="w-96">
      <Alert variant="warning">
        <AlertTitle>Approaching token limit</AlertTitle>
        <AlertDescription>You've used 78% of your monthly token budget. Consider upgrading your plan.</AlertDescription>
      </Alert>
    </div>
  ),
};

export const Danger: Story = {
  render: () => (
    <div className="w-96">
      <Alert variant="danger">
        <AlertTitle>API key expired</AlertTitle>
        <AlertDescription>Your OpenAI API key has expired. Update it in workspace settings to restore LLM access.</AlertDescription>
      </Alert>
    </div>
  ),
};

export const Dismissible: Story = {
  render: () => {
    const DismissDemo = () => {
      const [visible, setVisible] = useState(true);
      if (!visible) {
        return (
          <Button variant="secondary" size="sm" onClick={() => setVisible(true)}>
            Show alert again
          </Button>
        );
      }
      return (
        <div className="w-96">
          <Alert variant="info" dismissible onDismiss={() => setVisible(false)}>
            <AlertTitle>Tip: Keyboard shortcuts</AlertTitle>
            <AlertDescription>Press Ctrl+K to open the command palette from anywhere.</AlertDescription>
          </Alert>
        </div>
      );
    };
    return <DismissDemo />;
  },
};

export const WithActions: Story = {
  render: () => (
    <div className="w-96">
      <Alert variant="warning">
        <AlertTitle>MFA not enabled</AlertTitle>
        <AlertDescription>
          Your account doesn't have multi-factor authentication. Enable it for better security.
        </AlertDescription>
        <AlertActions>
          <Button size="sm" variant="secondary">Remind later</Button>
          <Button size="sm">Enable MFA</Button>
        </AlertActions>
      </Alert>
    </div>
  ),
};

export const WithCustomIcon: Story = {
  render: () => (
    <div className="w-96">
      <Alert variant="info" icon={<Shield className="h-4 w-4" />}>
        <AlertTitle>Security notice</AlertTitle>
        <AlertDescription>A new device signed in to your account from Stockholm, Sweden.</AlertDescription>
      </Alert>
    </div>
  ),
};

/** Showcases all alert variants and patterns */
export const AllVariants: Story = {
  render: () => {
    const DismissDemo = () => {
      const [visible, setVisible] = useState(true);
      return (
        <div>
          {visible ? (
            <Alert variant="info" dismissible onDismiss={() => setVisible(false)}>
              <AlertTitle>Dismissible alert</AlertTitle>
              <AlertDescription>Click the X to dismiss. Click the button to bring it back.</AlertDescription>
            </Alert>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setVisible(true)}>Restore alert</Button>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-8 w-[440px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Variants</p>
          <div className="space-y-3">
            <Alert variant="info">
              <AlertTitle>Information</AlertTitle>
              <AlertDescription>Neutral informational message for the user.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Operation completed successfully.</AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>Something needs attention but isn't critical.</AlertDescription>
            </Alert>
            <Alert variant="danger">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Something went wrong and needs immediate action.</AlertDescription>
            </Alert>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">With Actions</p>
          <Alert variant="warning">
            <AlertTitle>Approaching token limit</AlertTitle>
            <AlertDescription>78% of monthly budget used. Upgrade or adjust usage.</AlertDescription>
            <AlertActions>
              <Button size="sm" variant="ghost">Dismiss</Button>
              <Button size="sm">Upgrade Plan</Button>
            </AlertActions>
          </Alert>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Dismissible</p>
          <DismissDemo />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Minimal (description only)</p>
          <Alert variant="info">
            <AlertDescription>Your workspace has been updated to the latest version.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  },
  parameters: { layout: "padded" },
};
