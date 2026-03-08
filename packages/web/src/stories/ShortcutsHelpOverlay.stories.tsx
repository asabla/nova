import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ShortcutsHelpOverlay } from "@/components/ui/ShortcutsHelpOverlay";
import { useUIStore } from "@/stores/ui.store";

/**
 * Wrapper that forces the shortcuts overlay open via the UI store.
 * The component reads `shortcutsHelpOpen` from the store to decide
 * whether to render.
 */
function OpenShortcutsOverlay() {
  useEffect(() => {
    useUIStore.setState({ shortcutsHelpOpen: true });
    return () => {
      useUIStore.setState({ shortcutsHelpOpen: false });
    };
  }, []);

  return <ShortcutsHelpOverlay />;
}

const meta: Meta = {
  title: "Components/ShortcutsHelpOverlay",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

/** Keyboard shortcuts overlay modal — lists all registered shortcuts by category */
export const Default: Story = {
  render: () => <OpenShortcutsOverlay />,
};
