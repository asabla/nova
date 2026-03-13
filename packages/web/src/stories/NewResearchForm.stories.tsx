import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NewResearchForm, type NewResearchFormProps } from "@/components/research/NewResearchForm";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const meta: Meta<typeof NewResearchForm> = {
  title: "Research/NewResearchForm",
  component: NewResearchForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="max-w-[560px] mx-auto p-4">
          <div className="rounded-xl bg-surface border border-border p-5">
            <Story />
          </div>
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof NewResearchForm>;

const defaultSubmit = { onSubmit: (data: any) => console.log("Submit:", data) };

export const Default: Story = {
  args: {
    ...defaultSubmit,
    isPending: false,
  },
};

export const WithKnowledgeSelected: Story = {
  args: {
    ...defaultSubmit,
    isPending: false,
    defaultValues: {
      query: "What are the latest developments in federated learning?",
      sources: {
        webSearch: true,
        knowledgeCollectionIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
        fileIds: [],
      },
    },
  },
};

export const WithFilesSelected: Story = {
  args: {
    ...defaultSubmit,
    isPending: false,
    defaultValues: {
      query: "Summarize the Q4 financial report",
      sources: {
        webSearch: false,
        knowledgeCollectionIds: [],
        fileIds: ["00000000-0000-0000-0000-000000000010"],
      },
    },
  },
};

export const AllSourceTypes: Story = {
  args: {
    ...defaultSubmit,
    isPending: false,
    defaultValues: {
      query: "Compare our internal data with public research on transformer architectures",
      maxSources: 25,
      maxIterations: 5,
      sources: {
        webSearch: true,
        knowledgeCollectionIds: ["00000000-0000-0000-0000-000000000001"],
        fileIds: ["00000000-0000-0000-0000-000000000010", "00000000-0000-0000-0000-000000000011"],
      },
    },
  },
};

export const Submitting: Story = {
  args: {
    ...defaultSubmit,
    isPending: true,
    defaultValues: {
      query: "Research task in progress...",
    },
  },
};

export const Compact: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-80 p-4">
          <div className="rounded-xl bg-surface border border-border p-3">
            <Story />
          </div>
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    ...defaultSubmit,
    isPending: false,
    compact: true,
  },
};

export const CompactWithSources: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-80 p-4">
          <div className="rounded-xl bg-surface border border-border p-3">
            <Story />
          </div>
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    ...defaultSubmit,
    isPending: false,
    compact: true,
    defaultValues: {
      sources: {
        webSearch: true,
        knowledgeCollectionIds: ["00000000-0000-0000-0000-000000000001"],
        fileIds: ["00000000-0000-0000-0000-000000000010"],
      },
    },
  },
};

export const AllStates: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Full Layout</h3>
        <div className="rounded-xl bg-surface border border-border p-5">
          <NewResearchForm
            onSubmit={(data) => console.log("Submit:", data)}
            isPending={false}
          />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Compact Layout</h3>
        <div className="w-80">
          <div className="rounded-xl bg-surface border border-border p-3">
            <NewResearchForm
              onSubmit={(data) => console.log("Submit:", data)}
              isPending={false}
              compact
              defaultValues={{
                sources: {
                  webSearch: true,
                  knowledgeCollectionIds: ["00000000-0000-0000-0000-000000000001"],
                  fileIds: [],
                },
              }}
            />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Submitting</h3>
        <div className="rounded-xl bg-surface border border-border p-5">
          <NewResearchForm
            onSubmit={() => {}}
            isPending={true}
            defaultValues={{ query: "How do LLMs handle context windows?" }}
          />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">With Pre-filled Sources</h3>
        <div className="rounded-xl bg-surface border border-border p-5">
          <NewResearchForm
            onSubmit={(data) => console.log("Submit:", data)}
            isPending={false}
            defaultValues={{
              query: "Analyze transformer attention mechanisms",
              maxSources: 20,
              maxIterations: 7,
              outputFormat: "structured",
              sources: {
                webSearch: true,
                knowledgeCollectionIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
                fileIds: ["00000000-0000-0000-0000-000000000010"],
              },
            }}
          />
        </div>
      </div>
    </div>
  ),
};
