import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { MessageSquare, Bot, Search, FolderOpen, Upload, Plus } from "lucide-react";

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoConversations: Story = {
  render: () => (
    <EmptyState
      icon={<MessageSquare className="h-7 w-7" />}
      title="No conversations yet"
      description="Start a new conversation with an AI agent to get going."
      action={<Button><Plus className="h-4 w-4" /> New Conversation</Button>}
    />
  ),
};

export const NoAgents: Story = {
  render: () => (
    <EmptyState
      icon={<Bot className="h-7 w-7" />}
      title="No agents configured"
      description="Create your first agent to start automating tasks and workflows."
      action={<Button><Plus className="h-4 w-4" /> Create Agent</Button>}
    />
  ),
};

export const NoResults: Story = {
  render: () => (
    <EmptyState
      icon={<Search className="h-7 w-7" />}
      title="No results found"
      description="Try adjusting your search query or filters."
    />
  ),
};

export const NoFiles: Story = {
  render: () => (
    <EmptyState
      icon={<FolderOpen className="h-7 w-7" />}
      title="No files uploaded"
      description="Upload documents to build your knowledge base for RAG."
      action={<Button variant="secondary"><Upload className="h-4 w-4" /> Upload Files</Button>}
    />
  ),
};

export const InCard: Story = {
  render: () => (
    <Card className="w-96">
      <EmptyState
        icon={<Bot className="h-6 w-6" />}
        title="No agents"
        description="Create an agent to get started."
        action={<Button size="sm"><Plus className="h-3.5 w-3.5" /> Create</Button>}
        className="py-8"
      />
    </Card>
  ),
};

export const InTable: Story = {
  render: () => (
    <div className="w-[600px] rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3}>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="No matching records"
                description="Try changing your filters or search query."
                className="py-8"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
};

/** Showcases all empty state patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Full Page</p>
        <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden">
          <EmptyState
            icon={<MessageSquare className="h-7 w-7" />}
            title="No conversations yet"
            description="Start a new conversation with an AI agent to explore what NOVA can do."
            action={<Button><Plus className="h-4 w-4" /> New Conversation</Button>}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Search Empty</p>
        <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden">
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="No results found"
            description="We couldn't find anything matching your search. Try different keywords."
            className="py-8"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">In Card</p>
        <Card className="w-80">
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="No files"
            description="Upload documents to get started."
            action={<Button size="sm" variant="secondary"><Upload className="h-3.5 w-3.5" /> Upload</Button>}
            className="py-8"
          />
        </Card>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Minimal (no icon)</p>
        <div className="rounded-xl border border-border bg-surface-secondary overflow-hidden">
          <EmptyState
            title="Nothing here"
            description="This section is empty."
            className="py-8"
          />
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
