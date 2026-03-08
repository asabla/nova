import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Bot, MessageSquare, Zap, TrendingUp, Users, Clock } from "lucide-react";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  argTypes: {
    variant: { control: "select", options: ["default", "outline", "elevated"] },
    hover: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>A brief description of the card content.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">Card body content goes here.</p>
      </CardContent>
    </Card>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card variant="elevated" className="w-72">
      <CardHeader>
        <CardTitle>Elevated Card</CardTitle>
        <CardDescription>With shadow for emphasis.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">Elevated cards draw attention to key content.</p>
      </CardContent>
    </Card>
  ),
};

export const Hoverable: Story = {
  render: () => (
    <Card hover className="w-72">
      <CardHeader>
        <CardTitle>Hover me</CardTitle>
        <CardDescription>This card lifts on hover.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">Useful for clickable cards in grids.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-72">
      <CardHeader bordered>
        <CardTitle>Workspace Settings</CardTitle>
        <CardDescription>Manage your workspace configuration.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">Edit name, description, and permissions.</p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm">Cancel</Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  ),
};

/** Real-world card usage examples */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Variants</p>
        <div className="flex gap-4">
          <Card className="w-48">
            <CardContent><p className="text-sm text-text">Default</p></CardContent>
          </Card>
          <Card variant="outline" className="w-48">
            <CardContent><p className="text-sm text-text">Outline</p></CardContent>
          </Card>
          <Card variant="elevated" className="w-48">
            <CardContent><p className="text-sm text-text">Elevated</p></CardContent>
          </Card>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Agent Card</p>
        <Card hover className="w-72">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Research Analyst</CardTitle>
                <CardDescription>Deep web research with citations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5 mb-3">
              <Badge variant="primary">reasoning</Badge>
              <Badge variant="primary">search</Badge>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 1,240</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Jan 2026</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button size="sm"><Zap className="h-3 w-3" /> Use Agent</Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Stats Cards</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Conversations", value: "12,450", icon: MessageSquare, trend: "+12%" },
            { label: "Active Users", value: "342", icon: Users, trend: "+5%" },
            { label: "Tokens Used", value: "2.1M", icon: TrendingUp, trend: "+23%" },
          ].map((stat) => (
            <Card key={stat.label} className="w-48">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="h-4 w-4 text-text-tertiary" />
                  <span className="text-[10px] font-medium text-success">{stat.trend}</span>
                </div>
                <p className="text-2xl font-bold text-text tracking-tight">{stat.value}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Member Card</p>
        <Card className="w-72">
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar name="Sarah Chen" size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">Sarah Chen</p>
                <p className="text-xs text-text-tertiary">Admin</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
