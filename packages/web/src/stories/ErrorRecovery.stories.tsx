import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ErrorMessage } from "@/components/chat/ErrorMessage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

const meta: Meta = {
  title: "Patterns/ErrorRecovery",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** Rate limit error with countdown timer */
export const RateLimit: Story = {
  render: () => (
    <ErrorMessage
      error="Rate limit exceeded. Too many requests in the last minute."
      statusCode={429}
      onRetry={fn()}
      retryAfterSeconds={15}
    />
  ),
};

/** Server error with retry and fallback model */
export const ServerError: Story = {
  render: () => (
    <ErrorMessage
      error="Internal server error: model inference timeout after 30s"
      statusCode={500}
      onRetry={fn()}
      onRetryWithFallback={fn()}
      fallbackModel="claude-haiku-4-5"
    />
  ),
};

/** Network error */
export const NetworkError: Story = {
  render: () => (
    <ErrorMessage
      error="Failed to fetch: NetworkError when attempting to fetch resource."
      statusCode={0}
      onRetry={fn()}
    />
  ),
};

/** Unknown/generic error */
export const UnknownError: Story = {
  render: () => (
    <ErrorMessage
      error="An unexpected error occurred while processing your message."
      onRetry={fn()}
    />
  ),
};

/** Error after multiple auto-retries */
export const AfterAutoRetries: Story = {
  render: () => (
    <ErrorMessage
      error="Connection refused: ECONNREFUSED 127.0.0.1:3001"
      statusCode={0}
      onRetry={fn()}
      retryCount={3}
      maxAutoRetries={3}
    />
  ),
};

/** ErrorBoundary default fallback UI */
export const ErrorBoundaryFallback: Story = {
  render: () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4 text-center border border-border rounded-xl bg-surface">
      <AlertTriangle className="h-12 w-12 text-danger mb-4" />
      <h2 className="text-lg font-semibold text-text mb-2">Something went wrong</h2>
      <p className="text-sm text-text-secondary mb-4 max-w-md">
        The component encountered an error and could not render. This is the ErrorBoundary fallback.
      </p>
      <Button variant="primary" onClick={fn()}>
        <RefreshCw className="h-4 w-4" />
        Reload Page
      </Button>
    </div>
  ),
};

/** Custom fallback for specific sections */
export const CustomFallback: Story = {
  render: () => (
    <div className="rounded-xl border border-border bg-surface-secondary p-6 text-center">
      <WifiOff className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
      <h3 className="text-sm font-medium text-text mb-1">Connection Lost</h3>
      <p className="text-xs text-text-secondary mb-4">
        Unable to load this section. Check your connection and try again.
      </p>
      <div className="flex justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={fn()}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={fn()}>
          Dismiss
        </Button>
      </div>
    </div>
  ),
};

/** All error patterns gallery */
export const AllPatterns: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Rate Limit (429)
      </p>
      <ErrorMessage
        error="Rate limit exceeded. Please wait before sending more messages."
        statusCode={429}
        onRetry={fn()}
        retryAfterSeconds={30}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Server Error (500)
      </p>
      <ErrorMessage
        error="Internal server error during inference"
        statusCode={500}
        onRetry={fn()}
        onRetryWithFallback={fn()}
        fallbackModel="claude-haiku-4-5"
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Network Error
      </p>
      <ErrorMessage
        error="Failed to fetch"
        statusCode={0}
        onRetry={fn()}
        retryCount={2}
        maxAutoRetries={3}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Unknown Error
      </p>
      <ErrorMessage
        error="Something unexpected happened"
        onRetry={fn()}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        ErrorBoundary Fallback
      </p>
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-border rounded-xl bg-surface">
        <AlertTriangle className="h-12 w-12 text-danger mb-4" />
        <h2 className="text-lg font-semibold text-text mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-4">Component rendering failed.</p>
        <Button variant="primary" onClick={fn()}>
          <RefreshCw className="h-4 w-4" /> Reload
        </Button>
      </div>
    </div>
  ),
};
