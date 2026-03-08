import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { URLPreviewCard } from "@/components/chat/URLPreviewCard";

// ── Helper: create a QueryClient pre-seeded with mock data ───────────────

function createSeededClient(url: string, data: Record<string, unknown> | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  if (data) {
    client.setQueryData(["url-preview", url], data);
  }
  return client;
}

// ── Mock preview data ────────────────────────────────────────────────────

const githubUrl = "https://github.com/anthropics/claude-code";
const githubData = {
  url: githubUrl,
  title: "anthropics/claude-code",
  description: "Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands.",
  image: "https://opengraph.githubassets.com/1/anthropics/claude-code",
  siteName: "GitHub",
  type: "website",
  youtubeVideoId: null,
};

const articleUrl = "https://blog.example.com/react-19-features";
const articleData = {
  url: articleUrl,
  title: "What's New in React 19: A Complete Guide",
  description: "React 19 introduces several groundbreaking features including the React Compiler, Server Components improvements, and new hooks for managing async state.",
  image: null,
  siteName: "Example Blog",
  type: "article",
  youtubeVideoId: null,
};

const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const youtubeData = {
  url: youtubeUrl,
  title: "Rick Astley - Never Gonna Give You Up",
  description: "The official video for Rick Astley's classic 1987 hit.",
  image: null,
  siteName: "YouTube",
  type: "video",
  youtubeVideoId: "dQw4w9WgXcQ",
};

// ── Meta ─────────────────────────────────────────────────────────────────

const meta: Meta<typeof URLPreviewCard> = {
  title: "Chat/URLPreviewCard",
  component: URLPreviewCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 500, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof URLPreviewCard>;

/** Standard link preview with image, title, description */
export const WithImage: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededClient(githubUrl, githubData)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { url: githubUrl },
};

/** Link preview without image */
export const WithoutImage: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededClient(articleUrl, articleData)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { url: articleUrl },
};

/** YouTube video with embedded player */
export const YouTubeVideo: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededClient(youtubeUrl, youtubeData)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: { url: youtubeUrl },
};

/** Loading skeleton state */
export const Loading: Story = {
  decorators: [
    (Story) => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            // Keep in loading state by using a query function that never resolves
            queryFn: () => new Promise(() => {}),
          },
        },
      });
      return (
        <QueryClientProvider client={client}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
  args: { url: "https://example.com/loading" },
};

/** All preview variants gallery */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          With Image
        </p>
        <QueryClientProvider client={createSeededClient(githubUrl, githubData)}>
          <URLPreviewCard url={githubUrl} />
        </QueryClientProvider>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Without Image
        </p>
        <QueryClientProvider client={createSeededClient(articleUrl, articleData)}>
          <URLPreviewCard url={articleUrl} />
        </QueryClientProvider>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          YouTube Embed
        </p>
        <QueryClientProvider client={createSeededClient(youtubeUrl, youtubeData)}>
          <URLPreviewCard url={youtubeUrl} />
        </QueryClientProvider>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
