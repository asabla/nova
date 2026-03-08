import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "@/components/ui/Tabs";
import { MessageSquare, Settings, Users, BarChart3, Shield, Bell } from "lucide-react";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  args: {
    tabs: [
      { id: "general", label: "General" },
      { id: "security", label: "Security" },
      { id: "notifications", label: "Notifications" },
    ],
    children: (activeTab: string) => (
      <div className="p-4 text-sm text-text-secondary">
        Content for <span className="font-semibold text-text">{activeTab}</span> tab
      </div>
    ),
  },
};

export const WithIcons: Story = {
  args: {
    tabs: [
      { id: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
      { id: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
      { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
    ],
    children: (activeTab: string) => (
      <div className="p-4 text-sm text-text-secondary">
        {activeTab === "chat" && "Recent conversations and messages will appear here."}
        {activeTab === "members" && "Workspace members and their roles."}
        {activeTab === "settings" && "Workspace configuration and preferences."}
      </div>
    ),
  },
};

/** Full showcase of tab patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10 max-w-xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Text Only</p>
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "analytics", label: "Analytics" },
            { id: "reports", label: "Reports" },
          ]}
        >
          {(active) => (
            <div className="p-4 rounded-lg bg-surface-secondary text-sm text-text-secondary">
              Viewing: {active}
            </div>
          )}
        </Tabs>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">With Icons</p>
        <Tabs
          tabs={[
            { id: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
            { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
            { id: "security", label: "Security", icon: <Shield className="h-4 w-4" /> },
            { id: "notifications", label: "Alerts", icon: <Bell className="h-4 w-4" /> },
          ]}
        >
          {(active) => (
            <div className="p-4 rounded-lg bg-surface-secondary text-sm text-text-secondary">
              Viewing: {active}
            </div>
          )}
        </Tabs>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">With Rich Content</p>
        <Tabs
          tabs={[
            { id: "models", label: "Models" },
            { id: "usage", label: "Usage" },
          ]}
        >
          {(active) => (
            <div className="space-y-3">
              {active === "models" && (
                <>
                  {["GPT-4o", "Claude Opus", "Llama 3.1"].map((model) => (
                    <div key={model} className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border">
                      <span className="text-sm font-medium text-text">{model}</span>
                      <span className="text-xs text-text-tertiary">Active</span>
                    </div>
                  ))}
                </>
              )}
              {active === "usage" && (
                <div className="p-4 rounded-lg bg-surface-secondary border border-border">
                  <p className="text-2xl font-bold text-text">12,450</p>
                  <p className="text-xs text-text-tertiary">Tokens used this month</p>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </div>
    </div>
  ),
};
