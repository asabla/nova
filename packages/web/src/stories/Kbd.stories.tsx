import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd, KbdCombo } from "@/components/ui/Kbd";

const meta: Meta<typeof Kbd> = {
  title: "Components/Kbd",
  component: Kbd,
  argTypes: {
    size: { control: "select", options: ["sm", "md"] },
  },
};

export default meta;
type Story = StoryObj<typeof Kbd>;

export const Single: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Kbd>K</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>Tab</Kbd>
      <Kbd>Space</Kbd>
    </div>
  ),
};

export const Combo: Story = {
  render: () => (
    <div className="space-y-3">
      <KbdCombo keys={["Ctrl", "K"]} />
      <br />
      <KbdCombo keys={["Ctrl", "Shift", "P"]} />
      <br />
      <KbdCombo keys={["Cmd", "Enter"]} />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <KbdCombo keys={["Ctrl", "K"]} size="sm" />
        <span className="text-xs text-text-tertiary">Small</span>
      </div>
      <div className="flex items-center gap-2">
        <KbdCombo keys={["Ctrl", "K"]} size="md" />
        <span className="text-xs text-text-tertiary">Medium</span>
      </div>
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <div className="w-72 p-4 rounded-xl bg-surface-secondary border border-border space-y-3">
      {[
        { label: "Command palette", keys: ["Ctrl", "K"] },
        { label: "New conversation", keys: ["Ctrl", "N"] },
        { label: "Toggle sidebar", keys: ["Ctrl", "B"] },
        { label: "Search", keys: ["Ctrl", "F"] },
        { label: "Settings", keys: ["Ctrl", ","] },
      ].map(({ label, keys }) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{label}</span>
          <KbdCombo keys={keys} size="sm" />
        </div>
      ))}
    </div>
  ),
};

/** Showcases all keyboard shortcut indicator patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Individual Keys</p>
        <div className="flex items-center gap-2 flex-wrap">
          {["Esc", "Tab", "Enter", "Space", "Shift", "Ctrl", "Alt", "Cmd", "Fn"].map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Arrow Keys</p>
        <div className="flex items-center gap-2">
          <Kbd>←</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>→</Kbd>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Common Combos</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <KbdCombo keys={["Ctrl", "C"]} />
            <span className="text-xs text-text-tertiary">Copy</span>
          </div>
          <div className="flex items-center gap-3">
            <KbdCombo keys={["Ctrl", "V"]} />
            <span className="text-xs text-text-tertiary">Paste</span>
          </div>
          <div className="flex items-center gap-3">
            <KbdCombo keys={["Ctrl", "Shift", "P"]} />
            <span className="text-xs text-text-tertiary">Command Palette</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Sizes</p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <KbdCombo keys={["Ctrl", "K"]} size="sm" />
            <span className="text-[10px] font-mono text-text-tertiary">sm</span>
          </div>
          <div className="flex items-center gap-2">
            <KbdCombo keys={["Ctrl", "K"]} size="md" />
            <span className="text-[10px] font-mono text-text-tertiary">md</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">In Shortcuts Panel</p>
        <div className="w-80 p-4 rounded-xl bg-surface-secondary border border-border space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">Navigation</p>
          {[
            { label: "Command palette", keys: ["⌘", "K"] },
            { label: "New conversation", keys: ["⌘", "N"] },
            { label: "Toggle sidebar", keys: ["⌘", "B"] },
            { label: "Search conversations", keys: ["⌘", "F"] },
            { label: "Settings", keys: ["⌘", ","] },
            { label: "Close dialog", keys: ["Esc"] },
          ].map(({ label, keys }) => (
            <div key={label} className="flex items-center justify-between py-0.5">
              <span className="text-sm text-text-secondary">{label}</span>
              <KbdCombo keys={keys} size="sm" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Inline Usage</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          Press <KbdCombo keys={["⌘", "K"]} size="sm" /> to open the command palette,
          or <Kbd size="sm">/</Kbd> to start a slash command in the chat input.
          Use <KbdCombo keys={["⌘", "Enter"]} size="sm" /> to send a message.
        </p>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
