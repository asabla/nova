import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Send, RotateCcw, User, Loader2, MessageSquare, Eye, EyeOff } from "lucide-react";
import { adminApi } from "@/lib/api";

interface AgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  visibility: string;
  isPublished: boolean;
  avatarUrl: string;
  toolApprovalMode: string;
  starters: string[];
  defaultTier: string;
  effortLevel: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

const DEFAULT_STARTERS = [
  "Introduce yourself",
  "What can you help me with?",
  "Give me an example of your work",
  "What are your limitations?",
];

export function AgentPreviewPanel({ form }: { form: AgentFormData }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agentColor = form.avatarUrl?.startsWith("color:")
    ? form.avatarUrl.slice(6)
    : "#6366f1";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const testMutation = useMutation({
    mutationFn: (prompt: string) =>
      adminApi.post<{ content?: string; error?: string }>("/admin-api/marketplace/agents/test", {
        prompt,
        systemPrompt: form.systemPrompt || undefined,
        modelId: form.modelId || undefined,
        modelParams: {
          ...(form.defaultTier ? { defaultTier: form.defaultTier } : {}),
          ...(form.effortLevel && form.effortLevel !== "medium" ? { effortLevel: form.effortLevel } : {}),
        },
      }),
    onSuccess: (data) => {
      if (data.error) {
        setMessages((prev) => [...prev, { role: "error", content: data.error! }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content ?? "" }]);
      }
    },
    onError: (err: any) => {
      setMessages((prev) => [...prev, { role: "error", content: err.message ?? "Request failed" }]);
    },
  });

  const handleSend = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || testMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    testMutation.mutate(msg);
  };

  const reset = () => {
    setMessages([]);
    setInput("");
  };

  const starters = form.starters.filter(Boolean).length > 0 ? form.starters.filter(Boolean) : DEFAULT_STARTERS;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${agentColor}15` }}>
            <Bot className="h-4 w-4" style={{ color: agentColor }} />
          </div>
          <span className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
            {form.name || "Preview"}
          </span>
          {form.isPublished ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{ background: "var(--color-accent-green-dim)", color: "var(--color-accent-green)" }}>
              <Eye className="h-2.5 w-2.5" /> Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-muted)" }}>
              <EyeOff className="h-2.5 w-2.5" /> Draft
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: "var(--color-text-muted)" }}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: `${agentColor}10`, boxShadow: `0 0 40px ${agentColor}15` }}>
              <Bot className="h-10 w-10" style={{ color: agentColor }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
              Preview your agent
            </h3>
            <p className="text-xs mb-6 max-w-xs" style={{ color: "var(--color-text-muted)" }}>
              Test how the agent responds with the current system prompt and model settings.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {starters.slice(0, 4).map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="text-left text-xs p-3 rounded-xl border transition-all hover:border-opacity-80"
                  style={{
                    background: "var(--color-surface-raised)",
                    borderColor: "var(--color-border-subtle)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role !== "user" && (
                  <div className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: msg.role === "error" ? "var(--color-accent-red-dim)" : `${agentColor}15` }}>
                    <Bot className="h-3.5 w-3.5" style={{ color: msg.role === "error" ? "var(--color-accent-red)" : agentColor }} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md"
                      : msg.role === "error"
                        ? "rounded-2xl rounded-bl-md border"
                        : "rounded-2xl rounded-bl-md"
                  }`}
                  style={
                    msg.role === "user"
                      ? { background: agentColor, color: "#fff" }
                      : msg.role === "error"
                        ? { background: "var(--color-accent-red-dim)", borderColor: "var(--color-accent-red)", color: "var(--color-accent-red)" }
                        : { background: "var(--color-surface-raised)", color: "var(--color-text-primary)" }
                  }
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: "var(--color-surface-overlay)" }}>
                    <User className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                  </div>
                )}
              </div>
            ))}
            {testMutation.isPending && (
              <div className="flex gap-2.5">
                <div className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${agentColor}15` }}>
                  <Bot className="h-3.5 w-3.5" style={{ color: agentColor }} />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md" style={{ background: "var(--color-surface-raised)" }}>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{ background: "var(--color-text-muted)", animationDelay: `${i * 200}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-5 pb-4 pt-2">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Send a test message…"
            className="w-full h-10 rounded-xl border pl-3.5 pr-10 text-sm"
            style={{
              background: "var(--color-surface-overlay)",
              borderColor: "var(--color-border-default)",
              color: "var(--color-text-primary)",
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || testMutation.isPending}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: input.trim() ? `${agentColor}20` : "transparent" }}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: agentColor }} />
            ) : (
              <Send className="h-3.5 w-3.5" style={{ color: input.trim() ? agentColor : "var(--color-text-muted)" }} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
