import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "@/components/markdown/CodeBlock";

const meta: Meta<typeof CodeBlock> = {
  title: "Content/CodeBlock",
  component: CodeBlock,
  tags: ["autodocs"],
  argTypes: {
    language: {
      control: "select",
      options: ["typescript", "javascript", "python", "rust", "go", "sql", "bash", "json", "html", "css"],
    },
    code: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof CodeBlock>;

export const TypeScript: Story = {
  args: {
    language: "typescript",
    code: `interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
}

async function getUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  if (!response.ok) throw new Error("User not found");
  return response.json();
}`,
  },
};

export const Python: Story = {
  args: {
    language: "python",
    code: `from dataclasses import dataclass
from typing import Optional

@dataclass
class Agent:
    name: str
    model: str
    temperature: float = 0.7
    system_prompt: Optional[str] = None

    def run(self, query: str) -> str:
        """Execute the agent with the given query."""
        messages = self._build_messages(query)
        return self.model.complete(messages)`,
  },
};

export const SQL: Story = {
  args: {
    language: "sql",
    code: `SELECT
  c.id,
  c.title,
  COUNT(m.id) AS message_count,
  MAX(m.created_at) AS last_message_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.org_id = $1
  AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY last_message_at DESC
LIMIT 50;`,
  },
};

export const JSON: Story = {
  args: {
    language: "json",
    code: `{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain quantum computing." }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "stream": true
}`,
  },
};

export const Bash: Story = {
  args: {
    language: "bash",
    code: `#!/bin/bash
# Deploy NOVA to production
set -euo pipefail

echo "Building containers..."
docker compose build api web worker

echo "Running database migrations..."
docker compose exec api bun run db:migrate

echo "Starting services..."
docker compose up -d

echo "Deployment complete!"`,
  },
};

/** Showcases code blocks across multiple languages */
export const AllLanguages: Story = {
  render: () => (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">TypeScript</p>
        <CodeBlock
          language="typescript"
          code={`const agent = await createAgent({
  name: "Research Assistant",
  model: "claude-opus-4",
  tools: [webSearch, codeExec],
});`}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Python</p>
        <CodeBlock
          language="python"
          code={`def embed_document(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding`}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">SQL</p>
        <CodeBlock
          language="sql"
          code={`SELECT name, embedding <=> $1 AS distance
FROM knowledge_chunks
ORDER BY distance ASC
LIMIT 10;`}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Bash</p>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:3000/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}'`}
        />
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
