import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StreamingMessage } from "@/components/chat/StreamingMessage";

const meta: Meta<typeof StreamingMessage> = {
  title: "Chat/StreamingMessage",
  component: StreamingMessage,
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
