import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Alert } from "@/components/ui/Alert";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { Kbd } from "@/components/ui/Kbd";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Textarea } from "@/components/ui/Textarea";
import {
  MessageSquare, Star, AlertTriangle, CheckCircle, Info,
  Search, Bell, Settings, User,
} from "lucide-react";

const meta: Meta = {
  title: "NOVA/DarkModeAudit",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

/**
 * Renders children in both light and dark theme panels side-by-side.
 */
function ThemeDual({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-text mb-3">{label}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div data-theme="light" className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-3">Light</p>
          {children}
        </div>
        <div data-theme="dark" className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 mb-3">Dark</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Side-by-side dark mode comparison of all UI primitives */
export const Default: Story = {
  render: () => (
    <div className="max-w-5xl">
      <h2 className="text-lg font-semibold text-text mb-1">Dark Mode Audit</h2>
      <p className="text-sm text-text-secondary mb-6">
        Every component rendered in both Light and Dark themes for visual comparison.
      </p>

      <ThemeDual label="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
        </div>
      </ThemeDual>

      <ThemeDual label="Inputs">
        <div className="space-y-3">
          <Input label="Email" placeholder="user@example.com" />
          <Input label="With Error" error="This field is required" value="invalid" />
          <Input placeholder="Disabled" disabled />
          <Textarea placeholder="Write a message..." />
        </div>
      </ThemeDual>

      <ThemeDual label="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
        </div>
      </ThemeDual>

      <ThemeDual label="Alerts">
        <div className="space-y-2">
          <Alert variant="info">Informational alert message</Alert>
          <Alert variant="success">Success alert message</Alert>
          <Alert variant="warning">Warning alert message</Alert>
          <Alert variant="danger">Error alert message</Alert>
        </div>
      </ThemeDual>

      <ThemeDual label="Avatars">
        <div className="flex items-center gap-3">
          <Avatar name="Sarah Chen" size="sm" />
          <Avatar name="Marcus Rivera" size="md" />
          <Avatar name="Emily Watson" size="lg" />
        </div>
      </ThemeDual>

      <ThemeDual label="Toggle Controls">
        <div className="space-y-3">
          <Switch label="Enabled switch" checked />
          <Switch label="Disabled switch" />
          <Checkbox label="Checked checkbox" checked />
          <Checkbox label="Unchecked checkbox" />
        </div>
      </ThemeDual>

      <ThemeDual label="Progress & Skeleton">
        <div className="space-y-3">
          <ProgressBar value={65} />
          <ProgressBar value={100} />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      </ThemeDual>

      <ThemeDual label="Typography & Keyboard">
        <div className="space-y-2">
          <p className="text-text text-sm">Primary text</p>
          <p className="text-text-secondary text-sm">Secondary text</p>
          <p className="text-text-tertiary text-sm">Tertiary text</p>
          <div className="flex gap-1.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </div>
      </ThemeDual>

      <ThemeDual label="Separator">
        <div className="space-y-3">
          <p className="text-sm text-text">Content above</p>
          <Separator />
          <p className="text-sm text-text">Content below</p>
        </div>
      </ThemeDual>

      <ThemeDual label="Surface Levels">
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-surface border border-border">
            <p className="text-xs text-text">bg-surface (base)</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-secondary border border-border">
            <p className="text-xs text-text">bg-surface-secondary</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-tertiary border border-border">
            <p className="text-xs text-text">bg-surface-tertiary</p>
          </div>
        </div>
      </ThemeDual>

      <ThemeDual label="Chat-like Composition">
        <div className="space-y-2">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[70%] px-3 py-2 rounded-2xl rounded-br-md bg-primary text-white text-xs">
              How do I implement RAG?
            </div>
          </div>
          {/* Assistant message */}
          <div className="flex justify-start">
            <div className="max-w-[70%] px-3 py-2 rounded-2xl rounded-bl-md bg-surface-secondary border border-border text-xs text-text">
              RAG (Retrieval-Augmented Generation) combines a retrieval system with an LLM...
            </div>
          </div>
        </div>
      </ThemeDual>
    </div>
  ),
};
