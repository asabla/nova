import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { api } from "../../lib/api";
import { queryKeys, messagesOptions, conversationDetailOptions } from "../../lib/query-keys";
import { MessageList } from "../../components/chat/MessageList";
import { MessageInput } from "../../components/chat/MessageInput";
import { useSSEStream } from "../../hooks/useSSE";
import { useAuthStore } from "../../stores/auth.store";

export const Route = createFileRoute("/_auth/conversations/$id")({
  component: ConversationPage,
});

function ConversationPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { tokens, status, startStream, stopStream, resetStream } = useSSEStream();

  const { data: conversation } = useQuery(conversationDetailOptions(id));
  const { data: messagesData } = useQuery(messagesOptions(id));

  const messages = (messagesData as any)?.data ?? [];

  useEffect(() => {
    if (status === "done" && tokens) {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      resetStream();
    }
  }, [status, tokens, id, queryClient, resetStream]);

  const handleSend = useCallback(async (content: string) => {
    await api.post(`/api/conversations/${id}/messages`, {
      content,
      senderType: "user",
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });

    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    startStream(`${apiUrl}/api/conversations/${id}/messages/stream`, {
      content,
    });
  }, [id, queryClient, startStream]);

  const handleRate = useCallback(async (messageId: string, rating: 1 | -1) => {
    await api.post(`/api/conversations/${id}/messages/${messageId}/rate`, { rating });
  }, [id]);

  const handleFileUpload = useCallback(async (file: File) => {
    const presign = await api.post<{ uploadUrl: string; fileId: string }>(
      "/api/files/presign",
      { fileName: file.name, mimeType: file.type, size: file.size },
    );

    await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    await api.post("/api/files/confirm", { fileId: presign.fileId });
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MessageList
        messages={messages}
        streamingContent={status === "streaming" ? tokens : undefined}
        isStreaming={status === "streaming"}
        userName={user?.name}
        onRate={handleRate}
      />
      <MessageInput
        onSend={handleSend}
        onStop={stopStream}
        isStreaming={status === "streaming"}
        onFileUpload={handleFileUpload}
      />
    </div>
  );
}
