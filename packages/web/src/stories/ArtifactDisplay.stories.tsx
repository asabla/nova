import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArtifactDisplay } from "@/components/chat/ArtifactDisplay";
import { ArtifactRenderer, type ArtifactData } from "@/components/chat/ArtifactRenderer";

// ── Mock artifacts ───────────────────────────────────────────────────────

const codeArtifact = {
  id: "art-1",
  type: "code" as const,
  title: "React Counter Component",
  content: `import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex items-center gap-4">
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}`,
  language: "tsx",
};

const tableArtifact = {
  id: "art-2",
  type: "table" as const,
  title: "Model Comparison",
  content: `Model,Parameters,Context,Speed
GPT-4,1.8T,128K,Medium
Claude 3.5,Unknown,200K,Fast
Gemini Ultra,1.6T,1M,Medium
Llama 3,70B,8K,Very Fast`,
};

const documentArtifact = {
  id: "art-3",
  type: "document" as const,
  title: "API Design Notes",
  content: `# API Design Notes

## Authentication
All endpoints require Bearer token authentication.
Tokens are issued via /auth/login and expire after 24 hours.

## Rate Limiting
- Free tier: 100 requests/minute
- Pro tier: 1000 requests/minute
- Enterprise: Custom limits`,
};

const htmlArtifact = {
  id: "art-4",
  type: "html" as const,
  title: "Interactive Demo",
  content: `<!DOCTYPE html>
<html>
<body style="font-family: system-ui; padding: 20px; background: #1a1a2e; color: #eee;">
  <h2>Hello from NOVA</h2>
  <p>This is a sandboxed HTML preview.</p>
  <button onclick="this.textContent='Clicked!'" style="padding: 8px 16px; border-radius: 8px; border: none; background: #6366f1; color: white; cursor: pointer;">Click me</button>
</body>
</html>`,
};

const mermaidArtifact = {
  id: "art-5",
  type: "mermaid" as const,
  title: "Auth Flow Diagram",
  content: `graph TD
    A[User] -->|Login| B[Auth Server]
    B -->|Token| C[API Gateway]
    C -->|Validate| D[Resource Server]
    D -->|Response| A`,
};

// ── ArtifactDisplay Meta ─────────────────────────────────────────────────

const meta: Meta<typeof ArtifactDisplay> = {
  title: "Chat/ArtifactDisplay",
  component: ArtifactDisplay,
  parameters: { layout: "padded" },
  args: {
    onSave: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArtifactDisplay>;

/** Code artifact with syntax highlighting */
export const CodeArtifact: Story = {
  args: { artifact: codeArtifact },
};

/** CSV/Table artifact with sortable columns */
export const TableArtifactStory: Story = {
  name: "Table Artifact",
  args: { artifact: tableArtifact },
};

/** Document/text artifact */
export const DocumentArtifact: Story = {
  args: { artifact: documentArtifact },
};

/** HTML artifact with sandboxed preview */
export const HtmlArtifact: Story = {
  args: { artifact: htmlArtifact },
};

/** Mermaid diagram artifact */
export const MermaidArtifact: Story = {
  args: { artifact: mermaidArtifact },
};

/** ArtifactRenderer — code type */
export const RendererCode: Story = {
  render: () => (
    <ArtifactRenderer
      artifact={{
        id: "r-1",
        type: "code",
        title: "Helper Function",
        content: `function debounce(fn: Function, ms: number) {\n  let timer: number;\n  return (...args: any[]) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}`,
        language: "typescript",
      }}
    />
  ),
};

/** ArtifactRenderer — CSV type */
export const RendererCSV: Story = {
  render: () => (
    <ArtifactRenderer
      artifact={{
        id: "r-2",
        type: "csv",
        title: "Sales Data",
        content: `Quarter,Revenue,Growth\nQ1 2025,$1.2M,12%\nQ2 2025,$1.5M,25%\nQ3 2025,$1.8M,20%\nQ4 2025,$2.1M,17%`,
      }}
    />
  ),
};

/** All artifact types gallery */
export const AllTypes: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Code
      </p>
      <ArtifactDisplay artifact={codeArtifact} onSave={fn()} />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Table
      </p>
      <ArtifactDisplay artifact={tableArtifact} onSave={fn()} />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Document
      </p>
      <ArtifactDisplay artifact={documentArtifact} onSave={fn()} />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        HTML Preview
      </p>
      <ArtifactDisplay artifact={htmlArtifact} onSave={fn()} />
    </div>
  ),
  parameters: { layout: "padded" },
};
