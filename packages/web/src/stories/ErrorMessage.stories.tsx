import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ErrorMessage } from "@/components/chat/ErrorMessage";

const meta: Meta<typeof ErrorMessage> = {
  title: "Chat/ErrorMessage",
  component: ErrorMessage,
  args: {
    onRetry: fn(),
  },
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof ErrorMessage>;

export const SimpleError: Story = {
  args: {
    error: "Something went wrong. Please try again.",
  },
};

export const WithStatusCode: Story = {
  args: {
    error: "The server is temporarily unavailable.",
    statusCode: 503,
  },
};

export const RateLimited: Story = {
  args: {
    error: "Rate limit exceeded. Please wait before sending another message.",
    statusCode: 429,
    retryAfterSeconds: 30,
  },
};

export const WithFallbackModel: Story = {
  args: {
    error: "The requested model is currently unavailable.",
    statusCode: 503,
    fallbackModel: "gpt-4o-mini",
    onRetryWithFallback: fn(),
  },
};

export const WithRetryCount: Story = {
  args: {
    error: "Connection timed out.",
    retryCount: 2,
    maxAutoRetries: 3,
  },
};

export const ErrorObject: Story = {
  args: {
    error: new Error("Network request failed: ECONNREFUSED"),
  },
};

/** Showcases all error patterns seen in chat */
export const AllPatterns: Story = {
  render: () => (
    <div className="space-y-6 max-w-lg">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Generic Error</p>
        <ErrorMessage error="Something went wrong. Please try again." onRetry={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Rate Limited (429)</p>
        <ErrorMessage
          error="You've exceeded the rate limit for this model."
          statusCode={429}
          retryAfterSeconds={45}
          onRetry={fn()}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Model Unavailable with Fallback</p>
        <ErrorMessage
          error="Claude Opus is currently at capacity."
          statusCode={503}
          fallbackModel="gpt-4o"
          onRetry={fn()}
          onRetryWithFallback={fn()}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Auto-Retry in Progress</p>
        <ErrorMessage
          error="Request timed out."
          retryCount={1}
          maxAutoRetries={3}
          onRetry={fn()}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Auth Error (401)</p>
        <ErrorMessage
          error="Your session has expired. Please sign in again."
          statusCode={401}
        />
      </div>
    </div>
  ),
};
