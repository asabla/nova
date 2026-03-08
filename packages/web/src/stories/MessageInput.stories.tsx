import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { MessageInput } from "@/components/chat/MessageInput";

const meta: Meta<typeof MessageInput> = {
  title: "Chat/MessageInput",
  component: MessageInput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onSend: fn(),
    onStop: fn(),
    onPause: fn(),
    onResume: fn(),
    onFileUpload: fn(),
    onTyping: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 700, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MessageInput>;

/** Default empty state */
export const Default: Story = {};

/** Disabled input (e.g. no active conversation) */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

/** While AI is streaming a response — shows stop/pause controls */
export const Streaming: Story = {
  args: {
    isStreaming: true,
  },
};

/** Paused streaming — shows resume/stop controls */
export const Paused: Story = {
  args: {
    isStreaming: true,
    isPaused: true,
  },
};

/** Without file upload capability (no paperclip icon) */
export const NoFileUpload: Story = {
  args: {
    onFileUpload: undefined,
  },
};

/** All states side by side */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Default (ready to type)
        </p>
        <MessageInput onSend={fn()} onFileUpload={fn()} onTyping={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Streaming (stop/pause controls)
        </p>
        <MessageInput onSend={fn()} onStop={fn()} onPause={fn()} isStreaming onFileUpload={fn()} onTyping={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Paused (resume/stop controls)
        </p>
        <MessageInput onSend={fn()} onStop={fn()} onResume={fn()} isStreaming isPaused onFileUpload={fn()} onTyping={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Disabled
        </p>
        <MessageInput onSend={fn()} disabled onFileUpload={fn()} onTyping={fn()} />
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
