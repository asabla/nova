import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StreamingMessage } from "@/components/chat/StreamingMessage";

const meta: Meta<typeof StreamingMessage> = {
  title: "Chat/StreamingMessage",
  component: StreamingMessage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
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
type Story = StoryObj<typeof StreamingMessage>;

/** Empty state — typing indicator dots before any content arrives */
export const TypingIndicator: Story = {
  args: {
    content: "",
  },
};

/** Partial content mid-stream */
export const PartialContent: Story = {
  args: {
    content: "Here's a quick overview of the key differences between",
  },
};

/** Rich markdown content mid-stream */
export const WithMarkdown: Story = {
  args: {
    content:
      "## Key Differences\n\n1. **Performance** — React uses a virtual DOM for efficient updates\n2. **Syntax** — JSX provides a familiar HTML-like syntax\n\n```tsx\nfunction App() {\n  return <h1>Hello</h1>;\n}\n```\n\nLet me continue explaining...",
  },
};

// Simulated streaming component
const STREAMING_TEXT =
  "I'd be happy to help you with that! Here are the key points:\n\n1. **First**, make sure your dependencies are up to date\n2. **Second**, check the configuration file\n3. **Third**, run the test suite\n\n```bash\nnpm install\nnpm test\n```\n\nLet me know if you need more details on any of these steps.";

function SimulatedStreaming() {
  const [content, setContent] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= STREAMING_TEXT.length) return;
    const chunkSize = Math.floor(Math.random() * 3) + 1;
    const timer = setTimeout(() => {
      setContent(STREAMING_TEXT.slice(0, index + chunkSize));
      setIndex((i) => i + chunkSize);
    }, 30 + Math.random() * 40);
    return () => clearTimeout(timer);
  }, [index]);

  return <StreamingMessage content={content} />;
}

/** Animated streaming simulation — content appears character by character */
export const Simulated: Story = {
  render: () => <SimulatedStreaming />,
};

/** All streaming states */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Typing Indicator (no content yet)
        </p>
        <StreamingMessage content="" />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Partial Content
        </p>
        <StreamingMessage content="Let me think about this for a moment..." />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          With Code Block
        </p>
        <StreamingMessage content={"Here's the fix:\n\n```ts\nconst result = await fetch(url);\n```"} />
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};

/** Cancelled mid-stream — partial content with cancellation notice */
export const Cancelled: Story = {
  args: {
    content: "Here's a quick overview of the key differences between React and Vue:\n\n1. **Virtual DOM** — Both use virtual DOM, but React's reconciliation algorithm differs from Vue's reactivity system\n2. **State management** —",
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-surface-tertiary text-xs text-text-tertiary italic">
          Generation cancelled by user
        </div>
      </div>
    ),
  ],
};

/** Timeout state — content cut off after timeout */
export const Timeout: Story = {
  args: {
    content: "I'm analyzing the large dataset you provided. The initial findings suggest that there are several patterns worth investigating:\n\n1. **Seasonal trends** — Sales data shows a clear quarterly pattern with peaks in Q4\n2. **Regional variance** —",
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-warning/10 text-xs text-warning">
          Response timed out after 120s. Partial content shown.
        </div>
      </div>
    ),
  ],
};

/** Rate limited state */
export const RateLimited: Story = {
  args: {
    content: "",
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-warning/10 text-xs text-warning flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-warning animate-pulse" />
          Rate limited — retrying in 5s...
        </div>
      </div>
    ),
  ],
};

/** Retrying state — shows retry attempt info */
export const Retrying: Story = {
  args: {
    content: "",
  },
  decorators: [
    (Story) => (
      <div>
        <Story />
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-primary/10 text-xs text-primary flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
          Retrying (2/3)...
        </div>
      </div>
    ),
  ],
};
