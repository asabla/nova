import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { MessageInput } from "../../components/chat/MessageInput";
import { useSSEStream } from "../../hooks/useSSE";

export const Route = createFileRoute("/_auth/conversations/new")({
  component: NewConversationPage,
});

function NewConversationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tokens, status, startStream, stopStream, resetStream } = useSSEStream();

  const createAndSend = useCallback(async (content: string) => {
    const conversation = await api.post<{ id: string }>("/api/conversations", {
      title: content.slice(0, 100),
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });

    navigate({ to: `/conversations/${conversation.id}`, replace: true });
  }, [navigate, queryClient]);

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">{t("conversations.newTitle")}</h2>
          <p className="text-sm text-text-secondary mb-6">{t("conversations.newDescription")}</p>

          <div className="grid grid-cols-2 gap-2">
            {[
              "Explain quantum computing in simple terms",
              "Help me write a Python script",
              "What are the best practices for React?",
              "Summarize the latest AI research",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => createAndSend(prompt)}
                className="text-left text-xs p-3 rounded-xl bg-surface-secondary border border-border text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <MessageInput onSend={createAndSend} />
    </div>
  );
}
