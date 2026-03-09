import { useState, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VisuallyHidden, SkipLink, FocusTrap, Announce } from "@/components/ui/AccessibleLabel";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Eye, EyeOff, Accessibility, Volume2 } from "lucide-react";

const meta: Meta = {
  title: "Utilities/Accessibility",
};

export default meta;
type Story = StoryObj;

export const VisuallyHiddenDemo: Story = {
  render: () => {
    const Demo = () => {
      const [showHidden, setShowHidden] = useState(false);
      return (
        <div className="space-y-4 w-96">
          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <p className="text-sm text-text mb-3">
              The button below has a{" "}
              <code className="text-xs bg-surface-tertiary px-1 py-0.5 rounded font-mono">VisuallyHidden</code>{" "}
              label for screen readers:
            </p>
            <button
              className="p-2 rounded-lg bg-surface-tertiary hover:bg-border transition-colors"
              aria-label="Delete item"
            >
              🗑️
              {!showHidden && <VisuallyHidden> Delete this item permanently</VisuallyHidden>}
              {showHidden && (
                <span className="ml-2 text-sm text-text-secondary">Delete this item permanently</span>
              )}
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showHidden ? "Hide" : "Reveal"} hidden text
          </Button>
          <p className="text-xs text-text-tertiary">
            Screen readers always see the hidden text. Toggle to visualize what they read.
          </p>
        </div>
      );
    };
    return <Demo />;
  },
};

export const SkipLinkDemo: Story = {
  render: () => (
    <div className="space-y-4 w-96">
      <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-3">
        <p className="text-sm text-text font-medium">SkipLink Demo</p>
        <p className="text-xs text-text-secondary">
          Tab into this story to see the skip link appear in the top-left corner.
          It allows keyboard users to bypass navigation and jump to main content.
        </p>
        <div className="relative overflow-hidden rounded-lg border border-border p-4">
          <SkipLink targetId="story-main-content">Skip to main content</SkipLink>
          <nav className="space-y-1 mb-4">
            <a href="#" className="block text-sm text-text-secondary hover:text-text px-2 py-1 rounded focus-visible:outline-2 focus-visible:outline-primary">
              Home
            </a>
            <a href="#" className="block text-sm text-text-secondary hover:text-text px-2 py-1 rounded focus-visible:outline-2 focus-visible:outline-primary">
              Agents
            </a>
            <a href="#" className="block text-sm text-text-secondary hover:text-text px-2 py-1 rounded focus-visible:outline-2 focus-visible:outline-primary">
              Settings
            </a>
          </nav>
          <main id="story-main-content">
            <p className="text-sm text-text">Main content area</p>
          </main>
        </div>
      </div>
      <p className="text-xs text-text-tertiary">
        Press <kbd className="text-[10px] font-mono bg-surface-tertiary border border-border rounded px-1">Tab</kbd>{" "}
        to focus the skip link. It becomes visible only when focused.
      </p>
    </div>
  ),
};

export const FocusTrapDemo: Story = {
  render: () => {
    const Demo = () => {
      const [trapped, setTrapped] = useState(false);
      return (
        <div className="space-y-4 w-96">
          <Button onClick={() => setTrapped(true)}>Open trapped dialog</Button>
          {trapped && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="fixed inset-0 bg-overlay" onClick={() => setTrapped(false)} />
              <FocusTrap active onEscape={() => setTrapped(false)} restoreFocus>
                <div className="relative bg-surface border border-border rounded-xl shadow-2xl p-5 w-80 space-y-4">
                  <h3 className="text-sm font-semibold text-text">Focus is trapped here</h3>
                  <p className="text-xs text-text-secondary">
                    Tab cycles only through the focusable elements within this dialog.
                    Press Escape to close.
                  </p>
                  <input
                    className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-primary"
                    placeholder="Try tabbing..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setTrapped(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => setTrapped(false)}>
                      Confirm
                    </Button>
                  </div>
                </div>
              </FocusTrap>
            </div>
          )}
          <p className="text-xs text-text-tertiary">
            FocusTrap prevents keyboard focus from leaving the dialog. Essential for modals.
          </p>
        </div>
      );
    };
    return <Demo />;
  },
};

export const AnnounceDemo: Story = {
  render: () => {
    const Demo = () => {
      const [message, setMessage] = useState("");
      const [log, setLog] = useState<string[]>([]);
      const counter = useRef(0);

      const announce = (text: string) => {
        counter.current++;
        setMessage(text);
        setLog((prev) => [...prev.slice(-4), `#${counter.current}: ${text}`]);
      };

      return (
        <div className="space-y-4 w-96">
          <Announce message={message} politeness="polite" />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => announce("File saved successfully")}>
              Announce: Saved
            </Button>
            <Button size="sm" variant="secondary" onClick={() => announce("3 new messages received")}>
              Announce: Messages
            </Button>
            <Button size="sm" variant="secondary" onClick={() => announce("Error: Connection lost")}>
              Announce: Error
            </Button>
          </div>
          <div className="p-3 rounded-lg bg-surface-tertiary border border-border min-h-[80px]">
            <div className="flex items-center gap-1.5 mb-2">
              <Volume2 className="h-3 w-3 text-text-tertiary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                Screen Reader Log
              </span>
            </div>
            {log.length === 0 && (
              <p className="text-xs text-text-tertiary italic">Click a button to announce…</p>
            )}
            {log.map((entry, i) => (
              <p key={i} className="text-xs text-text-secondary font-mono">{entry}</p>
            ))}
          </div>
          <p className="text-xs text-text-tertiary">
            Announce uses an ARIA live region to convey dynamic updates to screen readers
            without visual disruption.
          </p>
        </div>
      );
    };
    return <Demo />;
  },
};

/** Overview of all accessibility utilities */
export const AllUtilities: Story = {
  render: () => {
    const AnnounceDemo = () => {
      const [message, setMessage] = useState("");
      return (
        <>
          <Announce message={message} />
          <Button size="sm" variant="secondary" onClick={() => setMessage(`Update at ${new Date().toLocaleTimeString()}`)}>
            <Volume2 className="h-3 w-3" /> Trigger announcement
          </Button>
        </>
      );
    };

    return (
      <div className="space-y-8 max-w-lg">
        <div className="flex items-center gap-2 mb-2">
          <Accessibility className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-text">Accessibility Utilities</h2>
        </div>
        <p className="text-sm text-text-secondary -mt-4">
          Foundational components that make the NOVA interface accessible to all users.
        </p>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>VisuallyHidden</CardTitle>
              <Badge variant="primary">a11y</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Hides content visually while keeping it accessible to screen readers.
              Use for icon-only buttons, supplementary labels, or status information.
            </p>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg bg-surface-tertiary hover:bg-border transition-colors text-text">
                🗑️
                <VisuallyHidden>Delete conversation</VisuallyHidden>
              </button>
              <span className="text-xs text-text-tertiary">← Has hidden "Delete conversation" label</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>SkipLink</CardTitle>
              <Badge variant="primary">a11y</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Appears on Tab focus, letting keyboard users skip navigation and jump to main content.
              Always include one at the top of every page layout.
            </p>
            <div className="relative overflow-hidden rounded-lg border border-border h-10 flex items-center justify-center">
              <span className="text-[10px] text-text-tertiary">Tab here to see SkipLink</span>
              <SkipLink targetId="a11y-demo-main">Skip to content</SkipLink>
            </div>
            <span id="a11y-demo-main" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>FocusTrap</CardTitle>
              <Badge variant="primary">a11y</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              Constrains Tab/Shift+Tab to cycle within a container. Essential for modals, dialogs,
              and drawer overlays. Supports Escape callback and automatic focus restore.
            </p>
            <code className="text-[10px] font-mono text-text-secondary bg-surface-tertiary px-2 py-1 rounded block">
              {`<FocusTrap active onEscape={close} restoreFocus>`}
            </code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Announce</CardTitle>
              <Badge variant="primary">a11y</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-text-secondary mb-3">
              ARIA live region for dynamic announcements. Screen readers speak the message
              without any visual change. Use "polite" for non-urgent updates, "assertive" for critical alerts.
            </p>
            <AnnounceDemo />
          </CardContent>
        </Card>
      </div>
    );
  },
  parameters: { layout: "padded" },
};
