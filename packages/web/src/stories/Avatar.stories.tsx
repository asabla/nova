import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "@/components/ui/Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Components/Avatar",
  component: Avatar,
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
      description: "Avatar size",
    },
    name: { control: "text", description: "User's name (used for initials and color hash)" },
    src: { control: "text", description: "Image URL" },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const WithImage: Story = {
  args: {
    src: "https://api.dicebear.com/9.x/avataaars/svg?seed=Nova",
    name: "Ada Lovelace",
    size: "md",
  },
};

export const WithInitials: Story = {
  args: {
    name: "Ada Lovelace",
    size: "md",
  },
};

export const ExtraSmall: Story = {
  args: { name: "Tiny User", size: "xs" },
};

export const Large: Story = {
  args: { name: "John Doe", size: "lg" },
};

export const NoName: Story = {
  args: { size: "md" },
};

/** Showcases all sizes, color variations, and fallback states */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Sizes</p>
        <div className="flex items-end gap-4">
          <div className="text-center space-y-2">
            <Avatar name="Ada Lovelace" size="xs" />
            <p className="text-[10px] font-mono text-text-tertiary">xs</p>
          </div>
          <div className="text-center space-y-2">
            <Avatar name="Ada Lovelace" size="sm" />
            <p className="text-[10px] font-mono text-text-tertiary">sm</p>
          </div>
          <div className="text-center space-y-2">
            <Avatar name="Ada Lovelace" size="md" />
            <p className="text-[10px] font-mono text-text-tertiary">md</p>
          </div>
          <div className="text-center space-y-2">
            <Avatar name="Ada Lovelace" size="lg" />
            <p className="text-[10px] font-mono text-text-tertiary">lg</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Color Hashing</p>
        <p className="text-xs text-text-secondary mb-3">Each name generates a deterministic background color</p>
        <div className="flex items-center gap-3 flex-wrap">
          {["Alice Chen", "Bob Smith", "Carol Wu", "David Kim", "Eve Garcia", "Frank Liu", "Grace Park", "Henry Zhou"].map((name) => (
            <div key={name} className="flex items-center gap-2">
              <Avatar name={name} size="sm" />
              <span className="text-xs text-text-secondary">{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Fallback States</p>
        <div className="flex items-center gap-4">
          <div className="text-center space-y-2">
            <Avatar src="https://api.dicebear.com/9.x/avataaars/svg?seed=Nova" name="With Image" size="lg" />
            <p className="text-[10px] font-mono text-text-tertiary">image</p>
          </div>
          <div className="text-center space-y-2">
            <Avatar name="Initials Only" size="lg" />
            <p className="text-[10px] font-mono text-text-tertiary">initials</p>
          </div>
          <div className="text-center space-y-2">
            <Avatar src="https://broken.invalid/img.jpg" name="Broken Image" size="lg" />
            <p className="text-[10px] font-mono text-text-tertiary">broken src</p>
          </div>
          <div className="text-center space-y-2">
            <Avatar size="lg" />
            <p className="text-[10px] font-mono text-text-tertiary">no name</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">In Context — User List</p>
        <div className="w-72 p-3 rounded-xl bg-surface-secondary border border-border space-y-2">
          {[
            { name: "Sarah Connor", role: "Admin" },
            { name: "John Doe", role: "Member" },
            { name: "Jane Smith", role: "Viewer" },
          ].map((user) => (
            <div key={user.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-tertiary transition-colors">
              <Avatar name={user.name} size="sm" />
              <div>
                <p className="text-sm font-medium text-text">{user.name}</p>
                <p className="text-[10px] text-text-tertiary">{user.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
