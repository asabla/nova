import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";
import { Settings, User, LogOut, Trash2, Copy, Share2, MoreVertical, ChevronDown, Edit } from "lucide-react";

/** Accessible dropdown menu with keyboard navigation and item variants. */
const meta: Meta<typeof Dropdown> = {
  title: "Components/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

export const Default: Story = {
  render: () => (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2 text-sm text-text-secondary hover:text-text">
          Options <ChevronDown className="h-4 w-4" />
        </span>
      }
    >
      <DropdownItem onClick={fn()}>
        <Edit className="h-4 w-4" /> Edit
      </DropdownItem>
      <DropdownItem onClick={fn()}>
        <Copy className="h-4 w-4" /> Duplicate
      </DropdownItem>
      <DropdownItem onClick={fn()}>
        <Share2 className="h-4 w-4" /> Share
      </DropdownItem>
      <DropdownItem onClick={fn()} danger>
        <Trash2 className="h-4 w-4" /> Delete
      </DropdownItem>
    </Dropdown>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open the dropdown
    const trigger = canvas.getByRole("button", { expanded: false });
    await userEvent.click(trigger);
    // Menu should appear with menu items
    const menu = canvasElement.querySelector("[role='menu']");
    await expect(menu).not.toBeNull();
    const items = canvasElement.querySelectorAll("[role='menuitem']");
    await expect(items.length).toBe(4);
  },
};

export const AlignLeft: Story = {
  render: () => (
    <Dropdown
      align="left"
      trigger={
        <span className="flex items-center gap-2 text-sm text-text-secondary hover:text-text">
          Left Aligned <ChevronDown className="h-4 w-4" />
        </span>
      }
    >
      <DropdownItem onClick={fn()}>Option 1</DropdownItem>
      <DropdownItem onClick={fn()}>Option 2</DropdownItem>
      <DropdownItem onClick={fn()}>Option 3</DropdownItem>
    </Dropdown>
  ),
};

export const WithDisabledItems: Story = {
  render: () => (
    <Dropdown
      trigger={
        <span className="flex items-center gap-2 text-sm text-text-secondary hover:text-text">
          Actions <ChevronDown className="h-4 w-4" />
        </span>
      }
    >
      <DropdownItem onClick={fn()}>
        <Edit className="h-4 w-4" /> Edit
      </DropdownItem>
      <DropdownItem disabled>
        <Share2 className="h-4 w-4" /> Share (Disabled)
      </DropdownItem>
      <DropdownItem onClick={fn()} danger>
        <Trash2 className="h-4 w-4" /> Delete
      </DropdownItem>
    </Dropdown>
  ),
};

export const IconTrigger: Story = {
  render: () => (
    <Dropdown
      trigger={
        <span className="p-1.5 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors">
          <MoreVertical className="h-4 w-4" />
        </span>
      }
    >
      <DropdownItem onClick={fn()}>
        <Edit className="h-4 w-4" /> Rename
      </DropdownItem>
      <DropdownItem onClick={fn()}>
        <Copy className="h-4 w-4" /> Duplicate
      </DropdownItem>
      <DropdownItem onClick={fn()} danger>
        <Trash2 className="h-4 w-4" /> Delete
      </DropdownItem>
    </Dropdown>
  ),
};

/** Showcases all dropdown patterns */
export const AllPatterns: Story = {
  render: () => (
    <div className="space-y-12 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">User Menu</p>
        <Dropdown
          trigger={
            <span className="flex items-center gap-2 text-sm">
              <span className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white font-medium">JD</span>
              <span className="text-text-secondary">John Doe</span>
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
            </span>
          }
        >
          <DropdownItem onClick={fn()}>
            <User className="h-4 w-4" /> Profile
          </DropdownItem>
          <DropdownItem onClick={fn()}>
            <Settings className="h-4 w-4" /> Settings
          </DropdownItem>
          <DropdownItem onClick={fn()} danger>
            <LogOut className="h-4 w-4" /> Sign Out
          </DropdownItem>
        </Dropdown>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Conversation Actions</p>
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border w-80">
          <span className="text-sm text-text">How to deploy NOVA</span>
          <Dropdown
            trigger={
              <span className="p-1 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
                <MoreVertical className="h-4 w-4" />
              </span>
            }
          >
            <DropdownItem onClick={fn()}>
              <Edit className="h-4 w-4" /> Rename
            </DropdownItem>
            <DropdownItem onClick={fn()}>
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownItem>
            <DropdownItem onClick={fn()}>
              <Share2 className="h-4 w-4" /> Share
            </DropdownItem>
            <DropdownItem onClick={fn()} danger>
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownItem>
          </Dropdown>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
