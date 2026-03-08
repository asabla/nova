import type { Meta, StoryObj } from "@storybook/react-vite";
import { ModelCapabilityBadges } from "@/components/ui/ModelCapabilityBadges";

const meta: Meta<typeof ModelCapabilityBadges> = {
  title: "Components/ModelCapabilityBadges",
  component: ModelCapabilityBadges,
  tags: ["autodocs"],
  argTypes: {
    compact: {
      control: "boolean",
      description: "Compact mode — shows only icons without labels",
    },
    capabilities: {
      control: "object",
      description: "Array of capability strings",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ModelCapabilityBadges>;

export const Default: Story = {
  args: {
    capabilities: ["vision", "tools", "reasoning", "streaming"],
  },
};

export const Compact: Story = {
  args: {
    capabilities: ["vision", "tools", "reasoning", "code", "streaming", "json-mode"],
    compact: true,
  },
};

export const SingleCapability: Story = {
  args: {
    capabilities: ["vision"],
  },
};

/** Showcases model capability badges in real-world model cards */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 max-w-lg">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">All Capabilities</p>
        <ModelCapabilityBadges
          capabilities={["vision", "tools", "function-calling", "reasoning", "code", "streaming", "json-mode", "long-context"]}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Compact Mode</p>
        <ModelCapabilityBadges
          capabilities={["vision", "tools", "reasoning", "code", "streaming", "json-mode", "long-context"]}
          compact
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Model Cards</p>
        <div className="space-y-3">
          {[
            { name: "GPT-4o", provider: "OpenAI", caps: ["vision", "tools", "streaming", "json-mode", "long-context"] },
            { name: "Claude Opus 4", provider: "Anthropic", caps: ["vision", "tools", "reasoning", "code", "long-context"] },
            { name: "Llama 3.1 70B", provider: "Meta", caps: ["tools", "code", "streaming"] },
            { name: "Gemini 2.0 Pro", provider: "Google", caps: ["vision", "tools", "reasoning", "streaming", "long-context"] },
          ].map((model) => (
            <div key={model.name} className="p-4 rounded-xl bg-surface-secondary border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text">{model.name}</p>
                  <p className="text-[10px] text-text-tertiary">{model.provider}</p>
                </div>
              </div>
              <ModelCapabilityBadges capabilities={model.caps} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Unknown Capability Fallback</p>
        <ModelCapabilityBadges capabilities={["vision", "tools", "custom-capability", "experimental-feature"]} />
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
