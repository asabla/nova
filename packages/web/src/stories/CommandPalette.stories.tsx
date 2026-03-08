import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { CommandPalette } from "@/components/chat/CommandPalette";
import { useUIStore } from "@/stores/ui.store";

/**
 * Minimal router context for CommandPalette.
 * The component uses useNavigate() which requires a RouterProvider.
 * We create a memory router with a single catch-all route.
 */
const rootRoute = createRootRoute({ component: () => null });
const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });
const router = createRouter({
  routeTree: rootRoute,
  history: memoryHistory,
});

function CommandPaletteOpen() {
  useEffect(() => {
    useUIStore.setState({ omniBarOpen: true });
    return () => {
      useUIStore.setState({ omniBarOpen: false });
    };
  }, []);

  return <CommandPalette />;
}

const meta: Meta = {
  title: "Chat/CommandPalette",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      // @ts-expect-error — simplified router for storybook; type mismatch is expected
      <RouterProvider router={router}>
        <Story />
      </RouterProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** Command palette open — shows search, commands, and navigation items */
export const Default: Story = {
  render: () => <CommandPaletteOpen />,
};
