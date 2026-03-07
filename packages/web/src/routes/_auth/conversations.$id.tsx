import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect } from "react";
import { api } from "../../lib/api";
import { queryKeys, messagesOptions, conversationDetailOptions } from "../../lib/query-keys";
import { MessageList } from "../../components/chat/MessageList";
import { MessageInput } from "../../components/chat/MessageInput";
import { ConversationHeader } from "../../components/chat/ConversationHeader";
import { useSSEStream } from "../../hooks/useSSE";
import { useAuthStore } from "../../stores/auth.store";
import { useDragDrop } from "../../hooks/useDragDrop";
import { useClipboardPaste } from "../../hooks/useClipboardPaste";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/conversations/$id")({
  component: ConversationPage,
});

function ConversationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { tokens, status, startStream, stopStream, pauseStream, resumeStream, resetStream } = useSSEStream();
  const { onKeystroke, stopTyping } = useTypingIndicator(id);

  const { data: conversation } = useQuery(conversationDetailOptions(id));
  const { data: messagesData } = useQuery(messagesOptions(id));

  const messages = (messagesData as any)?.data ?? [];

  useEffect(() => {
    if (status === "done" && tokens) {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(id) });
      resetStream();
    }
  }, [status, tokens, id, queryClient, resetStream]);


  const editMessage = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/api/conversations/${id}/messages/${messageId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      toast("Message updated", "success");
    },
  });

  const getModelParams = useCallback(() => {
    const params = conversation?.modelParams ?? {};
    return {
      temperature: params.temperature,
      topP: params.topP,
      maxTokens: params.maxTokens,
    };
  }, [conversation]);

  const handleSend = useCallback(async (content: string) => {
    stopTyping();

    await api.post(`/api/conversations/${id}/messages`, {
      content,
      senderType: "user",
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });

    const model = conversation?.modelId;
    const modelParams = getModelParams();
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    startStream(`${apiUrl}/api/conversations/${id}/messages/stream`, {
      content,
      model: model ?? "default",
      ...modelParams,
      messages: [
        ...(conversation?.systemPrompt ? [{ role: "system", content: conversation.systemPrompt }] : []),
        ...messages.map((m: any) => ({ role: m.senderType === "user" ? "user" : "assistant", content: m.content })),
        { role: "user", content },
      ],
    });
  }, [id, queryClient, startStream, conversation, messages, getModelParams, stopTyping]);

  // Auto-send initial message from new conversation page
  const initialMessageSent = React.useRef(false);
  useEffect(() => {
    if (initialMessageSent.current) return;
    try {
      const initial = sessionStorage.getItem("nova:initial-message");
      if (initial) {
        sessionStorage.removeItem("nova:initial-message");
        initialMessageSent.current = true;
        handleSend(initial);
      }
    } catch { /* sessionStorage unavailable */ }
  }, [handleSend]);

  const handleRate = useCallback(async (messageId: string, rating: 1 | -1) => {
    await api.post(`/api/conversations/${id}/messages/${messageId}/rate`, { rating });
    toast(rating === 1 ? "Upvoted" : "Downvoted", "success");
  }, [id]);

  const handleNote = useCallback(async (messageId: string, content: string) => {
    await api.post(`/api/conversations/${id}/messages/${messageId}/notes`, { content });
    toast("Note added", "success");
  }, [id]);

  const handleEdit = useCallback((messageId: string, content: string) => {
    editMessage.mutate({ messageId, content });
  }, [editMessage]);

  const handleEditAndRerun = useCallback(async (messageId: string, content: string) => {
    // First, save the edit (storing old content in history)
    await api.patch(`/api/conversations/${id}/messages/${messageId}`, { content });
    await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });

    // Then trigger a re-run using all messages up to and including the edited one
    const msg = messages.find((m: any) => m.id === messageId);
    if (!msg) return;

    const idx = messages.indexOf(msg);
    const previousMessages = messages.slice(0, idx);
    const modelParams = getModelParams();

    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    startStream(`${apiUrl}/api/conversations/${id}/messages/stream`, {
      model: conversation?.modelId ?? "default",
      ...modelParams,
      messages: [
        ...(conversation?.systemPrompt ? [{ role: "system", content: conversation.systemPrompt }] : []),
        ...previousMessages.map((m: any) => ({
          role: m.senderType === "user" ? "user" : "assistant",
          content: m.content,
        })),
        { role: "user", content },
      ],
    });

    toast("Message updated — re-running...", "info");
  }, [id, messages, conversation, startStream, getModelParams, queryClient]);

  const handleRerun = useCallback(async (messageId: string, modelId?: string) => {
    const msg = messages.find((m: any) => m.id === messageId);
    if (!msg) return;

    const idx = messages.indexOf(msg);
    const previousMessages = messages.slice(0, idx + 1);
    const modelParams = getModelParams();

    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    startStream(`${apiUrl}/api/conversations/${id}/messages/stream`, {
      model: modelId ?? conversation?.modelId ?? "default",
      ...modelParams,
      messages: [
        ...(conversation?.systemPrompt ? [{ role: "system", content: conversation.systemPrompt }] : []),
        ...previousMessages.map((m: any) => ({
          role: m.senderType === "user" ? "user" : "assistant",
          content: m.content,
        })),
      ],
    });
  }, [id, messages, conversation, startStream, getModelParams]);

  const forkAtMessage = useMutation({
    mutationFn: (messageId: string) =>
      api.post<{ id: string }>(`/api/conversations/${id}/fork`, { messageId }),
    onSuccess: (data) => {
      toast("Conversation forked from message", "success");
      navigate({ to: `/conversations/${data.id}` });
    },
    onError: () => {
      toast("Failed to fork conversation", "error");
    },
  });

  const handleFork = useCallback((messageId: string) => {
    forkAtMessage.mutate(messageId);
  }, [forkAtMessage]);

  const uploadSingleFile = useCallback(async (file: File) => {
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
    return presign.fileId;
  }, []);

  const handleFileUpload = useCallback(async (files: File[]) => {
    const results = await Promise.allSettled(files.map(uploadSingleFile));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed === 0) {
      toast(`${succeeded} file${succeeded !== 1 ? "s" : ""} uploaded`, "success");
    } else {
      toast(`${succeeded} uploaded, ${failed} failed`, "error");
    }
  }, [uploadSingleFile]);

  const { isDragging, dragHandlers } = useDragDrop((files) => {
    handleFileUpload(files);
  });

  useClipboardPaste((file) => handleFileUpload([file]));

  return (
    <div className="flex flex-col flex-1 min-h-0 relative" {...dragHandlers}>
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center">
          <p className="text-primary font-medium">Drop files here</p>
        </div>
      )}
      <ConversationHeader conversation={conversation} />
      <MessageList
        messages={messages}
        streamingContent={(status === "streaming" || status === "paused") ? tokens : undefined}
        isStreaming={status === "streaming" || status === "paused"}
        userName={user?.name}
        conversationId={id}
        onRate={handleRate}
        onEdit={handleEdit}
        onEditAndRerun={handleEditAndRerun}
        onRerun={handleRerun}
        onNote={handleNote}
        onFork={handleFork}
      />
      <MessageInput
        onSend={handleSend}
        onStop={stopStream}
        onPause={pauseStream}
        onResume={resumeStream}
        isStreaming={status === "streaming"}
        isPaused={status === "paused"}
        onFileUpload={handleFileUpload}
        onTyping={onKeystroke}
      />
    </div>
  );
}
