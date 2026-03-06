import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Share2, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "../components/markdown/MarkdownRenderer";
import { Avatar } from "../components/ui/Avatar";

export const Route = createFileRoute("/shared/$token")({
  component: SharedConversationPage,
});

function SharedConversationPage() {
  const { token } = Route.useParams();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared", token],
    queryFn: async () => {
      const res = await fetch(`/api/export/shared/${token}`);
      if (!res.ok) throw new Error("Conversation not found or link expired");
      return res.json();
    },
  });

  const conversation = data as any;

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="animate-pulse text-text-secondary">Loading shared conversation...</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-text">Conversation Not Found</h1>
          <p className="text-sm text-text-secondary mt-1">This link may have expired or the conversation was deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-medium text-text">{conversation.title ?? "Shared Conversation"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 rounded-lg hover:bg-surface-secondary"
            >
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-3xl mx-auto py-6">
        {(conversation.messages ?? []).map((msg: any, i: number) => (
          <div key={msg.id ?? i} className={`flex gap-3 px-4 py-4 ${msg.senderType === "user" ? "flex-row-reverse" : ""}`}>
            <div className="shrink-0 mt-0.5">
              {msg.senderType === "user" ? (
                <Avatar name="User" size="sm" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
              )}
            </div>
            <div className={`flex flex-col max-w-[80%] ${msg.senderType === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-2xl px-4 py-2.5 ${
                  msg.senderType === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-surface-secondary border border-border rounded-tl-sm"
                }`}
              >
                {msg.senderType === "assistant" ? (
                  <MarkdownRenderer content={msg.content ?? ""} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border py-4 text-center">
        <p className="text-xs text-text-tertiary">
          Shared from NOVA - AI Chat Platform
        </p>
      </div>
    </div>
  );
}
