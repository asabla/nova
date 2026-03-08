import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SlashCommand } from "@/components/chat/SlashCommand";
import { MentionPopup } from "@/components/chat/MentionPopup";

// ── SlashCommand Meta ────────────────────────────────────────────────────

const meta: Meta<typeof SlashCommand> = {
  title: "Chat/SlashCommand",
  component: SlashCommand,
  parameters: { layout: "padded" },
  args: {
    onSelect: fn(),
    onClose: fn(),
    position: { top: 8, left: 16 },
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", height: 360, maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SlashCommand>;

/** All commands visible (empty query) */
export const AllCommands: Story = {
  args: { query: "" },
};

/** Filtered by "model" */
export const FilteredModel: Story = {
  args: { query: "model" },
};

/** Filtered by "export" */
export const FilteredExport: Story = {
  args: { query: "export" },
};

/** No results */
export const NoResults: Story = {
  args: { query: "zzz-no-match" },
};

/** MentionPopup with mock candidates */
export const MentionPopupStory: Story = {
  name: "MentionPopup",
  render: () => (
    <div style={{ position: "relative", height: 300, maxWidth: 400 }}>
      <MentionPopup
        query="al"
        position={{ top: 8, left: 16 }}
        onSelect={fn()}
        onClose={fn()}
        visible
      />
    </div>
  ),
};

/** MentionPopup with empty query (shows all) */
export const MentionPopupAllCandidates: Story = {
  name: "MentionPopup - All",
  render: () => (
    <div style={{ position: "relative", height: 300, maxWidth: 400 }}>
      <MentionPopup
        query=""
        position={{ top: 8, left: 16 }}
        onSelect={fn()}
        onClose={fn()}
        visible
      />
    </div>
  ),
};
