import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys, messagesOptions, conversationDetailOptions, artifactsOptions } from "../../lib/query-keys";
import { MessageList } from "../../components/chat/MessageList";
import { MessageInput } from "../../components/chat/MessageInput";
import { ConversationHeader } from "../../components/chat/ConversationHeader";
import { MessageSkeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { useSSEStream } from "../../hooks/useSSE";
import { useAuthStore } from "../../stores/auth.store";
import { useDragDrop } from "../../hooks/useDragDrop";
import { useClipboardPaste } from "../../hooks/useClipboardPaste";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import { toast } from "../../components/ui/Toast";
import { ErrorBoundary } from "../../components/ErrorBoundary";


export const Route = createFileRoute("/_auth/conversations/$id")({
  component: () => (
    <ErrorBoundary>
      <ConversationPage />
    </ErrorBoundary>
  ),
});

function ConversationPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { tokens, status, activeTools, agentFlow, startStream, stopStream, pauseStream, resumeStream, resetStream } = useSSEStream();
  const { onKeystroke, stopTyping } = useTypingIndicator(id);

  const { data: conversation, isLoading: isConversationLoading } = useQuery(conversationDetailOptions(id));
  const { data: messagesData, isLoading: isMessagesLoading } = useQuery(messagesOptions(id));
  const { data: artifactsData } = useQuery(artifactsOptions(id));

  const messages = (messagesData as any)?.data ?? [];
  const allArtifacts: any[] = (artifactsData as any)?.data ?? [];
  const isLoading = isConversationLoading || isMessagesLoading;

  // Group artifacts by messageId for efficient lookup
  const artifactsByMessageId = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of allArtifacts) {
      const list = map.get(a.messageId) ?? [];
      list.push(a);
      map.set(a.messageId, list);
    }
    return map;
  }, [allArtifacts]);

  useEffect(() => {
    if (status === "done" || status === "error") {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.artifacts(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      resetStream();
    }
  }, [status, id, queryClient, resetStream]);


  // --- Slash command handlers ---
  const handleClearConversation = useCallback(async () => {
    if (!window.confirm(t("conversations.confirmClear", "Clear all messages in this conversation?"))) return;
    try {
      await api.delete(`/api/conversations/${id}/messages`);
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      toast(t("conversations.cleared", "Conversation cleared"), "success");
    } catch {
      toast(t("conversations.clearFailed", "Failed to clear conversation"), "error");
    }
  }, [id, queryClient, t]);

  const handleExportConversation = useCallback(() => {
    if (!messages.length) {
      toast(t("conversations.noMessages", "No messages to export"), "info");
      return;
    }
    const title = conversation?.title ?? "conversation";
    const lines = messages.map((m: any) => {
      const role = m.senderType === "user" ? "User" : "Assistant";
      return `## ${role}\n\n${m.content ?? ""}\n`;
    });
    const md = `# ${title}\n\n${lines.join("\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, conversation]);

  const editMessage = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch(`/api/conversations/${id}/messages/${messageId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      toast(t("conversations.messageUpdated", "Message updated"), "success");
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

  const handleSend = useCallback(async (content: string, files?: File[], preUploadedAttachments?: { fileId: string; attachmentType: string }[]) => {
    stopTyping();

    try {
      // Upload files first if provided
      let attachments: { fileId: string; attachmentType: string }[] | undefined;
      if (files && files.length > 0) {
        const results = await Promise.allSettled(files.map(uploadSingleFile));
        attachments = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
          .map((r) => ({ fileId: r.value, attachmentType: "file" as const }));
      }

      // Merge pre-uploaded attachments (e.g. from home page)
      if (preUploadedAttachments?.length) {
        attachments = [...(attachments ?? []), ...preUploadedAttachments];
      }

      await api.post(`/api/conversations/${id}/messages`, {
        content,
        senderType: "user",
        ...(attachments?.length ? { attachments } : {}),
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });

      const model = conversation?.modelId;
      const modelParams = getModelParams();
      const apiUrl = import.meta.env.VITE_API_URL ?? "";
      startStream(`${apiUrl}/api/conversations/${id}/messages/stream`, {
        content,
        model: model ?? "default",
        ...modelParams,
        enableTools: true,
        messages: [
          ...(conversation?.systemPrompt ? [{ role: "system", content: conversation.systemPrompt }] : []),
          ...messages
            .filter((m: any) => m.content != null && m.content !== "")
            .map((m: any) => ({ role: m.senderType === "user" ? "user" : "assistant", content: m.content })),
          { role: "user", content },
        ],
      });
    } catch {
      toast(t("conversations.sendFailed", "Failed to send message"), "error");
    }
  }, [id, queryClient, startStream, conversation, messages, getModelParams, stopTyping, t]);

  // Auto-send initial message from new conversation page
  // Only send when conversation data has loaded to avoid race condition
  const initialMessageSent = React.useRef(false);
  useEffect(() => {
    if (initialMessageSent.current) return;
    if (!conversation) return; // Wait for conversation data to load
    try {
      const initial = sessionStorage.getItem("nova:initial-message");
      if (initial) {
        sessionStorage.removeItem("nova:initial-message");
        initialMessageSent.current = true;

        // Read pre-uploaded attachments from home page flow
        let preUploaded: { fileId: string; attachmentType: string }[] | undefined;
        try {
          const raw = sessionStorage.getItem("nova:initial-attachments");
          if (raw) {
            sessionStorage.removeItem("nova:initial-attachments");
            preUploaded = JSON.parse(raw);
          }
        } catch { /* ignore parse errors */ }

        handleSend(initial, undefined, preUploaded);
      }
    } catch { /* sessionStorage unavailable */ }
  }, [handleSend, conversation]);

  const rateMutation = useMutation({
    mutationFn: ({ messageId, rating }: { messageId: string; rating: 1 | -1 }) =>
      api.post(`/api/conversations/${id}/messages/${messageId}/rate`, { rating }),
    onSuccess: (_data, { rating }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      toast(rating === 1 ? t("conversations.upvoted", "Upvoted") : t("conversations.downvoted", "Downvoted"), "success");
    },
    onError: () => toast(t("conversations.rateFailed", "Failed to rate message"), "error"),
  });

  const noteMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.post(`/api/conversations/${id}/messages/${messageId}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(id) });
      toast(t("conversations.noteAdded", "Note added"), "success");
    },
    onError: () => toast(t("conversations.noteFailed", "Failed to add note"), "error"),
  });

  const handleRate = useCallback((messageId: string, rating: 1 | -1) => {
    rateMutation.mutate({ messageId, rating });
  }, [rateMutation]);

  const handleNote = useCallback((messageId: string, content: string) => {
    noteMutation.mutate({ messageId, content });
  }, [noteMutation]);

  const handleEdit = useCallback((messageId: string, content: string) => {
    editMessage.mutate({ messageId, content });
  }, [editMessage]);

  const handleEditAndRerun = useCallback(async (messageId: string, content: string) => {
    try {
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
          ...previousMessages
            .filter((m: any) => m.content != null && m.content !== "")
            .map((m: any) => ({
              role: m.senderType === "user" ? "user" : "assistant",
              content: m.content,
            })),
          { role: "user", content },
        ],
      });

      toast(t("conversations.messageRerunning", "Message updated — re-running..."), "info");
    } catch {
      toast(t("conversations.editRerunFailed", "Failed to edit and re-run message"), "error");
    }
  }, [id, messages, conversation, startStream, getModelParams, queryClient, t]);

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
        ...previousMessages
          .filter((m: any) => m.content != null && m.content !== "")
          .map((m: any) => ({
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
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      toast(t("conversations.forked", "Conversation forked from message"), "success");
      navigate({ to: `/conversations/${data.id}` });
    },
    onError: () => {
      toast(t("conversations.forkFailed", "Failed to fork conversation"), "error");
    },
  });

  const handleFork = useCallback((messageId: string) => {
    forkAtMessage.mutate(messageId);
  }, [forkAtMessage]);

  const uploadSingleFile = useCallback(async (file: File) => {
    const presign = await api.post<{ uploadUrl: string; fileId: string }>(
      "/api/files/presign",
      { filename: file.name, contentType: file.type, size: file.size },
    );

    await fetch(presign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    await api.post(`/api/files/${presign.fileId}/confirm`);
    return presign.fileId;
  }, []);

  const handleFileUpload = useCallback(async (files: File[]) => {
    const results = await Promise.allSettled(files.map(uploadSingleFile));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed === 0) {
      toast(`${succeeded} ${t("conversations.filesUploaded", "file(s) uploaded")}`, "success");
    } else {
      toast(`${succeeded} ${t("conversations.uploaded", "uploaded")}, ${failed} ${t("conversations.failed", "failed")}`, "error");
    }
  }, [uploadSingleFile, t]);

  const { isDragging, dragHandlers } = useDragDrop((files) => {
    handleFileUpload(files);
  });

  useClipboardPaste((file) => handleFileUpload([file]));

  // Handle SSE error status — re-stream the last user message without creating a duplicate
  const handleRetryLastMessage = useCallback(() => {
    resetStream();
    const lastUserMessage = [...messages].reverse().find((m: any) => m.senderType === "user");
    if (!lastUserMessage) return;

    const model = conversation?.modelId;
    const modelParams = getModelParams();
    const apiUrl = import.meta.env.VITE_API_URL ?? "";
    startStream(`${apiUrl}/api/conversations/${id}/messages/stream`, {
      content: lastUserMessage.content,
      model: model ?? "default",
      ...modelParams,
      enableTools: true,
      messages: [
        ...(conversation?.systemPrompt ? [{ role: "system", content: conversation.systemPrompt }] : []),
        ...messages
          .filter((m: any) => m.content != null && m.content !== "")
          .map((m: any) => ({ role: m.senderType === "user" ? "user" : "assistant", content: m.content })),
      ],
    });
  }, [messages, resetStream, conversation, getModelParams, startStream, id]);

  return (
    <div className="flex flex-col flex-1 min-h-0 relative" {...dragHandlers}>
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center">
          <p className="text-primary font-medium">{t("conversations.dropFilesHere", "Drop files here")}</p>
        </div>
      )}
      <ConversationHeader conversation={conversation} />

      {isLoading ? (
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <MessageList
            messages={messages}
            artifactsByMessageId={artifactsByMessageId}
            streamingContent={(status === "streaming" || status === "paused") ? tokens : undefined}
            isStreaming={status === "streaming" || status === "paused"}
            activeTools={activeTools}
            agentFlow={(status === "streaming" || status === "paused") ? agentFlow : undefined}
            userName={user?.name}
            conversationId={id}
            onRate={handleRate}
            onEdit={handleEdit}
            onEditAndRerun={handleEditAndRerun}
            onRerun={handleRerun}
            onNote={handleNote}
            onFork={handleFork}
          />

          {/* SSE error state */}
          {status === "error" && (
            <div role="alert" className="px-4 py-3 bg-danger/10 border-t border-danger/20 flex items-center justify-between">
              <p className="text-sm text-danger">
                {t("conversations.streamError", "Something went wrong while generating a response.")}
              </p>
              <Button variant="ghost" size="sm" onClick={handleRetryLastMessage}>
                <RefreshCw className="h-4 w-4" />
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}
        </>
      )}

      <MessageInput
        onSend={handleSend}
        onStop={stopStream}
        onPause={pauseStream}
        onResume={resumeStream}
        isStreaming={status === "streaming"}
        isPaused={status === "paused"}
        onFileUpload={handleFileUpload}
        onTyping={onKeystroke}
        disabled={isLoading}
        conversationId={id}
        onClearConversation={handleClearConversation}
        onExportConversation={handleExportConversation}
      />
    </div>
  );
}
