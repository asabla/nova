# packages/web -- Implementation Guide

> Runtime: **Bun** (build tooling + dev server)
> Framework: **React 19 + Vite + Tailwind CSS v4**
> Dev port: **5173**
> Production: Static files served by Nginx

---

## Directory Structure

```
packages/web/
├── src/
│   ├── main.tsx                    # React root, providers (QueryClient, Router, i18n)
│   ├── routes/
│   │   ├── __root.tsx              # Root layout (sidebar, header, WebSocket provider)
│   │   ├── _auth.tsx               # Auth layout guard (redirects to /login if no session)
│   │   ├── _auth/
│   │   │   ├── index.tsx           # Dashboard / conversation list
│   │   │   ├── conversations/
│   │   │   │   ├── $conversationId.tsx  # Conversation view (messages, streaming)
│   │   │   │   └── new.tsx              # New conversation
│   │   │   ├── agents/
│   │   │   │   ├── index.tsx       # Agent gallery
│   │   │   │   ├── $agentId.tsx    # Agent detail / edit
│   │   │   │   └── new.tsx         # Agent builder
│   │   │   ├── knowledge/
│   │   │   │   ├── index.tsx       # Collection list
│   │   │   │   └── $collectionId.tsx  # Collection detail
│   │   │   ├── workspaces/
│   │   │   │   ├── index.tsx       # Workspace list
│   │   │   │   └── $workspaceId.tsx   # Workspace view
│   │   │   ├── prompts/
│   │   │   │   └── index.tsx       # Prompt library
│   │   │   ├── search.tsx          # Cross-entity search
│   │   │   ├── settings/
│   │   │   │   ├── profile.tsx     # User profile, theme, locale
│   │   │   │   ├── sessions.tsx    # Active sessions
│   │   │   │   └── notifications.tsx  # Notification preferences
│   │   │   └── admin/
│   │   │       ├── users.tsx       # User management
│   │   │       ├── groups.tsx      # Group management
│   │   │       ├── org.tsx         # Org settings, branding
│   │   │       ├── models.tsx      # Model configuration
│   │   │       ├── analytics.tsx   # Usage dashboards
│   │   │       ├── audit.tsx       # Audit log viewer
│   │   │       └── health.tsx      # System health
│   │   ├── login.tsx               # Login page
│   │   ├── signup.tsx              # Sign-up page
│   │   └── shared.$shareId.tsx     # Public shared conversation (no auth required)
│   ├── components/
│   │   ├── chat/
│   │   │   ├── MessageList.tsx     # Virtualized message list
│   │   │   ├── MessageBubble.tsx   # Single message (user/assistant/system/tool)
│   │   │   ├── MessageInput.tsx    # Composing area (text, file attach, slash commands)
│   │   │   ├── StreamingMessage.tsx # Renders tokens as they arrive via SSE
│   │   │   ├── ToolCallCard.tsx    # Collapsible tool call display
│   │   │   ├── ApprovalDialog.tsx  # Human-in-the-loop approve/reject
│   │   │   └── TypingIndicator.tsx # Shows who is typing (WebSocket)
│   │   ├── markdown/
│   │   │   ├── MarkdownRenderer.tsx  # react-markdown pipeline
│   │   │   ├── CodeBlock.tsx       # Syntax-highlighted code with copy button
│   │   │   ├── MermaidDiagram.tsx  # Mermaid rendering
│   │   │   └── MathBlock.tsx       # KaTeX rendering
│   │   ├── files/
│   │   │   ├── FileUploader.tsx    # react-dropzone + presigned URL upload
│   │   │   ├── FilePreview.tsx     # Inline preview (image, PDF, etc.)
│   │   │   └── FileList.tsx        # File browser
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # Conversation list, navigation
│   │   │   ├── Header.tsx          # Org selector, user menu, notifications
│   │   │   ├── CommandPalette.tsx  # Cmd+K search (conversations, agents, commands)
│   │   │   └── StatusBanner.tsx    # Connection status, system degradation
│   │   ├── agents/
│   │   │   ├── AgentBuilder.tsx    # Agent configuration form
│   │   │   ├── AgentCard.tsx       # Agent gallery card
│   │   │   └── ToolSelector.tsx    # Tool/MCP picker for agents
│   │   ├── knowledge/
│   │   │   ├── CollectionForm.tsx  # Create/edit collection
│   │   │   └── ChunkViewer.tsx     # Show retrieved chunks in RAG response
│   │   └── ui/                     # Shared primitives (Button, Input, Dialog, etc.)
│   ├── hooks/
│   │   ├── useAuth.ts              # Better Auth React client
│   │   ├── useSSE.ts               # SSE stream consumption (fetch + ReadableStream)
│   │   ├── useWebSocket.ts         # WebSocket connection with auto-reconnect
│   │   ├── useConversation.ts      # Conversation CRUD + streaming
│   │   ├── useFileUpload.ts        # Presigned URL upload flow
│   │   ├── useSearch.ts            # Cross-entity search
│   │   ├── useKeyboardShortcuts.ts # Global keyboard shortcut registry
│   │   └── useTheme.ts             # Theme switching (light/dark/system)
│   ├── stores/
│   │   ├── auth.store.ts           # Session, user profile, active org
│   │   ├── ui.store.ts             # Sidebar state, theme, command palette open
│   │   └── ws.store.ts             # WebSocket connection state, typing indicators
│   ├── lib/
│   │   ├── api.ts                  # Fetch wrapper (base URL, auth headers, error handling)
│   │   ├── query-keys.ts           # TanStack Query key factory
│   │   ├── ws-client.ts            # WebSocket client (reconnecting-websocket wrapper)
│   │   └── sanitize.ts             # DOMPurify wrapper
│   ├── i18n/
│   │   ├── index.ts                # i18next setup
│   │   ├── en.json                 # English (default, always loaded)
│   │   └── [lang].json             # Lazy-loaded language bundles
│   └── styles/
│       └── app.css                 # Tailwind v4 entry (@import "tailwindcss")
├── index.html                      # Vite entry HTML
├── vite.config.ts
├── tailwind.config.ts              # Minimal (Tailwind v4 uses CSS-first config)
├── Dockerfile                      # Multi-stage: bun build -> nginx
├── package.json
└── tsconfig.json
```

---

## Vite + React 19 + Tailwind v4 Setup

### Vite Config

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),       // File-based route generation
    react(),
    tailwindcss(),              // Tailwind v4 Vite plugin (no PostCSS config needed)
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
```

### Tailwind v4 CSS Entry

```css
/* src/styles/app.css */
@import "tailwindcss";

@theme {
  --color-primary: #6366f1;
  --color-primary-foreground: #ffffff;
  --color-surface: #ffffff;
  --color-surface-dark: #1e1e2e;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

No `tailwind.config.js` is strictly required with Tailwind v4. Theme customization happens in CSS via `@theme`. If a config file is present, it is only for plugin registration or legacy compatibility.

---

## TanStack Router (File-Based Routing)

Routes are generated from the `src/routes/` directory structure. Type-safe params and search params.

```typescript
// src/routes/_auth/conversations/$conversationId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { conversationQueryOptions } from "../../lib/query-keys";

export const Route = createFileRoute("/_auth/conversations/$conversationId")({
  // Loader pre-fetches data before rendering
  loader: ({ context: { queryClient }, params: { conversationId } }) =>
    queryClient.ensureQueryData(conversationQueryOptions(conversationId)),

  component: ConversationView,
});

function ConversationView() {
  const { conversationId } = Route.useParams(); // fully typed: string
  const conversation = Route.useLoaderData();
  // ...
}
```

### Auth Guard Layout

```typescript
// src/routes/_auth.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Header />
        <Outlet />
      </main>
    </div>
  );
}
```

---

## TanStack Query (Server State)

### Query Key Factory

All query keys go through a factory for consistency and easy invalidation.

```typescript
// src/lib/query-keys.ts
import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export const queryKeys = {
  conversations: {
    all: ["conversations"] as const,
    list: (filters?: ConversationFilters) => [...queryKeys.conversations.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.conversations.all, "detail", id] as const,
    messages: (id: string) => [...queryKeys.conversations.all, "messages", id] as const,
  },
  agents: {
    all: ["agents"] as const,
    list: () => [...queryKeys.agents.all, "list"] as const,
    detail: (id: string) => [...queryKeys.agents.all, "detail", id] as const,
  },
  // ... per entity
};

export function conversationQueryOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => api.get(`/api/conversations/${id}`),
    staleTime: 30_000,
  });
}
```

### Optimistic Updates

```typescript
// src/hooks/useConversation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useRenameConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`/api/conversations/${id}`, { title }),

    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.conversations.detail(id) });
      const previous = queryClient.getQueryData(queryKeys.conversations.detail(id));
      queryClient.setQueryData(queryKeys.conversations.detail(id), (old: any) => ({
        ...old,
        title,
      }));
      return { previous };
    },

    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.conversations.detail(variables.id),
        context?.previous
      );
    },

    onSettled: (data, err, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(id) });
    },
  });
}
```

---

## Zustand Stores

### Auth Store

```typescript
// src/stores/auth.store.ts
import { create } from "zustand";

interface AuthState {
  session: Session | null;
  user: User | null;
  activeOrgId: string | null;
  setSession: (session: Session | null) => void;
  setActiveOrg: (orgId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  activeOrgId: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setActiveOrg: (orgId) => set({ activeOrgId: orgId }),
  logout: () => set({ session: null, user: null, activeOrgId: null }),
}));
```

### UI Store

```typescript
// src/stores/ui.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  commandPaletteOpen: boolean;
  theme: "light" | "dark" | "system";
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleCommandPalette: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      commandPaletteOpen: false,
      theme: "system",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "nova-ui" }
  )
);
```

### WebSocket Store

```typescript
// src/stores/ws.store.ts
import { create } from "zustand";

interface WSState {
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
  typingUsers: Map<string, Set<string>>; // conversationId -> set of userIds
  setStatus: (status: WSState["status"]) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

export const useWSStore = create<WSState>((set) => ({
  status: "disconnected",
  typingUsers: new Map(),
  setStatus: (status) => set({ status }),
  setTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const map = new Map(state.typingUsers);
      const users = new Set(map.get(conversationId) ?? []);
      if (isTyping) users.add(userId);
      else users.delete(userId);
      map.set(conversationId, users);
      return { typingUsers: map };
    }),
}));
```

---

## WebSocket Client

```typescript
// src/lib/ws-client.ts
import ReconnectingWebSocket from "reconnecting-websocket";
import { useWSStore } from "../stores/ws.store";
import { queryClient } from "../main";
import { queryKeys } from "./query-keys";

let ws: ReconnectingWebSocket | null = null;

export function connectWebSocket(token: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  ws = new ReconnectingWebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);

  ws.onopen = () => useWSStore.getState().setStatus("connected");
  ws.onclose = () => useWSStore.getState().setStatus("disconnected");
  ws.onreconnect = () => useWSStore.getState().setStatus("reconnecting");

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case "typing.start":
        useWSStore.getState().setTyping(msg.conversationId, msg.userId, true);
        break;

      case "typing.stop":
        useWSStore.getState().setTyping(msg.conversationId, msg.userId, false);
        break;

      case "message.new":
        // Invalidate TanStack Query cache to refetch
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messages(msg.conversationId),
        });
        break;

      case "conversation.updated":
        queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.detail(msg.conversationId),
        });
        break;

      case "notification.new":
        // Show toast, update notification badge
        break;
    }
  };
}

export function sendWsMessage(type: string, payload: Record<string, unknown>) {
  ws?.send(JSON.stringify({ type, ...payload }));
}

export function disconnectWebSocket() {
  ws?.close();
  ws = null;
}
```

---

## SSE Consumption (Streaming LLM Responses)

```typescript
// src/hooks/useSSE.ts
import { useCallback, useRef, useState } from "react";

export function useSSEStream() {
  const [tokens, setTokens] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (url: string, body: unknown) => {
    setTokens("");
    setStatus("streaming");
    abortRef.current = new AbortController();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("event: done")) {
            setStatus("done");
            return;
          }
          if (line.startsWith("event: heartbeat")) continue;
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setTokens((prev) => prev + data.content);
            }
          }
        }
      }

      setStatus("done");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setStatus("error");
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setStatus("done");
  }, []);

  return { tokens, status, startStream, stopStream };
}
```

---

## Markdown Rendering Pipeline

Renders assistant messages with syntax highlighting, math, diagrams, and XSS protection.

```typescript
// src/components/markdown/MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";
import { CodeBlock } from "./CodeBlock";
import { MermaidDiagram } from "./MermaidDiagram";

interface Props {
  content: string;
}

export function MarkdownRenderer({ content }: Props) {
  // Sanitize BEFORE rendering (defense against stored XSS)
  const sanitized = DOMPurify.sanitize(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeHighlight, rehypeKatex]}
      components={{
        code({ className, children, ...props }) {
          const language = className?.replace("language-", "");

          // Mermaid diagrams
          if (language === "mermaid") {
            return <MermaidDiagram chart={String(children)} />;
          }

          // Code blocks with syntax highlighting and copy button
          if (language) {
            return <CodeBlock language={language} code={String(children)} />;
          }

          // Inline code
          return <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded" {...props}>{children}</code>;
        },
        // Custom table rendering for CSV data
        table({ children }) {
          return (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">{children}</table>
            </div>
          );
        },
      }}
    >
      {sanitized}
    </ReactMarkdown>
  );
}
```

---

## File Upload (Presigned URL Pattern)

1. Client requests a presigned upload URL from the API
2. Client uploads directly to MinIO using the presigned URL
3. Client notifies the API that the upload is complete

```typescript
// src/hooks/useFileUpload.ts
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useFileUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      // 1. Get presigned URL from API
      const { uploadUrl, fileId, key } = await api.post("/api/files/presign", {
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      // 2. Upload directly to MinIO
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      // 3. Confirm upload
      await api.post(`/api/files/${fileId}/confirm`, { key });

      return { fileId, key };
    },
  });
}
```

```typescript
// src/components/files/FileUploader.tsx
import { useDropzone } from "react-dropzone";
import { useFileUpload } from "../../hooks/useFileUpload";

export function FileUploader({ onUpload }: { onUpload: (fileId: string) => void }) {
  const upload = useFileUpload();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      for (const file of files) {
        const result = await upload.mutateAsync(file);
        onUpload(result.fileId);
      }
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300"}`}>
      <input {...getInputProps()} />
      <p>{isDragActive ? "Drop files here" : "Drag files here or click to browse"}</p>
      {upload.isPending && <p>Uploading...</p>}
    </div>
  );
}
```

---

## i18next Setup

```typescript
// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Lazy-load other languages
export async function loadLanguage(lang: string) {
  if (i18n.hasResourceBundle(lang, "translation")) return;
  const module = await import(`./${lang}.json`);
  i18n.addResourceBundle(lang, "translation", module.default);
  i18n.changeLanguage(lang);
}

export default i18n;
```

---

## Auth (Better Auth React Client)

```typescript
// src/hooks/useAuth.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  basePath: "/api/auth",
});

// Usage in components:
// const { data: session } = authClient.useSession();
// authClient.signIn.email({ email, password });
// authClient.signUp.email({ email, password, name });
// authClient.signOut();
```

### Protected Route Pattern

The `_auth.tsx` layout route checks for a session before rendering child routes. If no session exists, it redirects to `/login`. The session is provided via the router context:

```typescript
// src/main.tsx
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen"; // Auto-generated by TanStack Router plugin

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient, auth: { session: null } },
});

function App() {
  const { data: session } = authClient.useSession();

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth: { session } }} />
    </QueryClientProvider>
  );
}
```

---

## Dockerfile

```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/web/package.json packages/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/web packages/web
RUN cd packages/web && bun run build

FROM nginx:alpine AS runtime
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Nginx Config

```nginx
# packages/web/nginx.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # No caching for index.html (ensures latest build)
  location = /index.html {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
  }
}
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^5.0.0",
    "react-markdown": "^9.0.0",
    "rehype-highlight": "^7.0.0",
    "rehype-katex": "^7.0.0",
    "remark-math": "^6.0.0",
    "remark-gfm": "^4.0.0",
    "dompurify": "^3.1.0",
    "react-dropzone": "^14.0.0",
    "reconnecting-websocket": "^4.4.0",
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "better-auth": "^1.4.0",
    "lucide-react": "^0.400.0",
    "date-fns": "^4.0.0",
    "@nova/shared": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^6.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@tanstack/router-plugin": "^1.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/dompurify": "^3.0.0",
    "typescript": "^5.5.0"
  }
}
```

---

## Environment Variables

Vite exposes env vars prefixed with `VITE_` to client code.

```bash
VITE_API_URL=http://localhost:3000   # API base URL (empty in production if same-origin)
VITE_WS_URL=ws://localhost:3000/ws   # WebSocket URL
```

No secrets should ever be in `VITE_*` variables -- they are embedded in the client bundle.
