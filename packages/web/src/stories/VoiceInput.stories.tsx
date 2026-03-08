import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VoiceInput } from "@/components/chat/VoiceInput";

const meta: Meta<typeof VoiceInput> = {
  title: "Chat/VoiceInput",
  component: VoiceInput,
  parameters: { layout: "centered" },
  args: {
    onTranscript: fn(),
    onAudioFile: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof VoiceInput>;

/** Default idle state — shows mic button */
export const Idle: Story = {};

/** Disabled state */
export const Disabled: Story = {
  args: { disabled: true },
};

/** Without audio file callback (speech-to-text only) */
export const SpeechToTextOnly: Story = {
  args: { onAudioFile: undefined },
};

/** All states side by side */
export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <VoiceInput onTranscript={fn()} onAudioFile={fn()} />
        <p className="text-[10px] text-text-tertiary mt-2">Default</p>
      </div>
      <div className="text-center">
        <VoiceInput onTranscript={fn()} onAudioFile={fn()} disabled />
        <p className="text-[10px] text-text-tertiary mt-2">Disabled</p>
      </div>
      <div className="text-center">
        <VoiceInput onTranscript={fn()} />
        <p className="text-[10px] text-text-tertiary mt-2">STT Only</p>
      </div>
    </div>
  ),
};
