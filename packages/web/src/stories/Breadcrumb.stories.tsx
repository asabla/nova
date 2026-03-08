import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/Breadcrumb";
import { Home, Settings, Users, FolderOpen, FileText } from "lucide-react";

const meta: Meta<typeof Breadcrumb> = {
  title: "Components/Breadcrumb",
  component: Breadcrumb,
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

export const Simple: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbItem href="#">Home</BreadcrumbItem>
      <BreadcrumbItem href="#">Workspaces</BreadcrumbItem>
      <BreadcrumbItem active>NOVA Dev</BreadcrumbItem>
    </Breadcrumb>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbItem href="#" icon={<Home className="h-3.5 w-3.5" />}>Home</BreadcrumbItem>
      <BreadcrumbItem href="#" icon={<Settings className="h-3.5 w-3.5" />}>Settings</BreadcrumbItem>
      <BreadcrumbItem active icon={<Users className="h-3.5 w-3.5" />}>Members</BreadcrumbItem>
    </Breadcrumb>
  ),
};

export const LongPath: Story = {
  render: () => (
    <Breadcrumb maxItems={4}>
      <BreadcrumbItem href="#">Home</BreadcrumbItem>
      <BreadcrumbItem href="#">Workspaces</BreadcrumbItem>
      <BreadcrumbItem href="#">NOVA Production</BreadcrumbItem>
      <BreadcrumbItem href="#">Knowledge</BreadcrumbItem>
      <BreadcrumbItem href="#">Engineering Docs</BreadcrumbItem>
      <BreadcrumbItem href="#">API Reference</BreadcrumbItem>
      <BreadcrumbItem active>Authentication</BreadcrumbItem>
    </Breadcrumb>
  ),
};

export const TwoItems: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbItem href="#">Agents</BreadcrumbItem>
      <BreadcrumbItem active>Research Analyst</BreadcrumbItem>
    </Breadcrumb>
  ),
};

export const SingleItem: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbItem active>Dashboard</BreadcrumbItem>
    </Breadcrumb>
  ),
};

/** Showcases all breadcrumb patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Simple</p>
        <Breadcrumb>
          <BreadcrumbItem href="#">Home</BreadcrumbItem>
          <BreadcrumbItem href="#">Settings</BreadcrumbItem>
          <BreadcrumbItem active>Appearance</BreadcrumbItem>
        </Breadcrumb>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">With Icons</p>
        <Breadcrumb>
          <BreadcrumbItem href="#" icon={<Home className="h-3.5 w-3.5" />}>Home</BreadcrumbItem>
          <BreadcrumbItem href="#" icon={<FolderOpen className="h-3.5 w-3.5" />}>Knowledge</BreadcrumbItem>
          <BreadcrumbItem href="#" icon={<FileText className="h-3.5 w-3.5" />}>Documents</BreadcrumbItem>
          <BreadcrumbItem active>API Reference</BreadcrumbItem>
        </Breadcrumb>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Truncated (7 items, max 4)</p>
        <Breadcrumb maxItems={4}>
          <BreadcrumbItem href="#">Home</BreadcrumbItem>
          <BreadcrumbItem href="#">Workspaces</BreadcrumbItem>
          <BreadcrumbItem href="#">NOVA Production</BreadcrumbItem>
          <BreadcrumbItem href="#">Knowledge</BreadcrumbItem>
          <BreadcrumbItem href="#">Engineering Docs</BreadcrumbItem>
          <BreadcrumbItem href="#">API Reference</BreadcrumbItem>
          <BreadcrumbItem active>Authentication</BreadcrumbItem>
        </Breadcrumb>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">In Context</p>
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <Breadcrumb>
            <BreadcrumbItem href="#" icon={<Home className="h-3.5 w-3.5" />}>Home</BreadcrumbItem>
            <BreadcrumbItem href="#">Agents</BreadcrumbItem>
            <BreadcrumbItem active>Research Analyst</BreadcrumbItem>
          </Breadcrumb>
          <h2 className="text-lg font-semibold text-text mt-4">Research Analyst</h2>
          <p className="text-sm text-text-secondary mt-1">Deep web research with structured citations</p>
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
