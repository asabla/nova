import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, FileText, Loader2, Bot, ArrowRight } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { MessageInput } from "../../components/chat/MessageInput";
import { toast } from "../../components/ui/Toast";
import { consumePendingFiles, setPendingFiles } from "../../lib/pending-files";
import { resolveIcon } from "../../lib/template-icons";
import { TemplateInputDialog } from "../../components/explore/TemplateInputDialog";
import type { ApiTemplate, ExploreTemplate } from "../../types/template";

export const Route = createFileRoute("/_auth/conversations/new")({
  component: NewConversationPage,
});

function toExploreTemplate(t: ApiTemplate): ExploreTemplate {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? "",
    content: t.content,
    category: t.category ?? "general",
    tags: (t.tags as string[]) ?? [],
    inputs: t.inputs ?? undefined,
    icon: resolveIcon(t.icon),
    color: t.color ?? "text-primary",
    bgColor: t.bgColor ?? "bg-primary/10",
    isSystem: t.isSystem,
  };
}

function NewConversationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Read agentId from URL search params (e.g. /conversations/new?agentId=xxx)
  const agentId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("agentId") ?? undefined
    : undefined;
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExploreTemplate | null>(null);

  const { data: agentData } = useQuery({
    queryKey: ["agents", agentId],
    queryFn: () => api.get<any>(`/api/agents/${agentId}`),
    enabled: !!agentId,
    staleTime: 60_000,
  });

  const agent = agentId ? (agentData as any) : null;

  // Load linked starter templates for this agent
  const { data: agentStartersData } = useQuery({
    queryKey: ["agents", agentId, "starters"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/starters`),
    enabled: !!agentId,
    staleTime: 60_000,
  });

  const linkedTemplates: ExploreTemplate[] = ((agentStartersData as any)?.data ?? []).map((t: any) => toExploreTemplate(t));

  // Load conversation starters from prompt templates (story #182)
  const { data: starterTemplates } = useQuery({
    queryKey: queryKeys.prompts.starters(),
    queryFn: () => api.get<any>("/api/prompts?category=starter&limit=8"),
    staleTime: 60_000,
  });

  const starters = (starterTemplates as any)?.data ?? [];

  const uploadSingleFile = useCallback(async (file: File) => {
    const presign = await api.post<{ uploadUrl: string; fileId: string }>(
      "/api/files/presign",
      { filename: file.name, contentType: file.type, size: file.size },
    );
    await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    await api.post(`/api/files/${presign.fileId}/confirm`);
    return presign.fileId;
  }, []);

  const createAndSend = useCallback(async (content: string, systemPrompt?: string, files?: File[]) => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const payload: any = {};
      if (agent?.modelId) payload.modelId = agent.modelId;
      if (systemPrompt) payload.systemPrompt = systemPrompt;
      else if (agent?.systemPrompt) payload.systemPrompt = agent.systemPrompt;
      if (agentId) payload.agentId = agentId;

      const conversation = await api.post<{ id: string }>("/api/conversations", payload);

      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });

      // Attach pre-selected knowledge collections (from home page)
      try {
        const knowledgeJson = sessionStorage.getItem("nova:starter-knowledge");
        if (knowledgeJson) {
          sessionStorage.removeItem("nova:starter-knowledge");
          const collectionIds: string[] = JSON.parse(knowledgeJson);
          await Promise.allSettled(
            collectionIds.map((knowledgeCollectionId) =>
              api.post(`/api/conversations/${conversation.id}/knowledge`, { knowledgeCollectionId }),
            ),
          );
        }
      } catch { /* ignore */ }

      // Upload files and build attachment list
      let attachmentMeta: { fileId: string; attachmentType: string }[] | undefined;
      if (files && files.length > 0) {
        const results = await Promise.allSettled(files.map(uploadSingleFile));
        attachmentMeta = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
          .map((fid) => ({ fileId: fid.value, attachmentType: "file" }));
      }

      // Store the initial message (and attachment info) so the conversation page can auto-send it
      try {
        sessionStorage.setItem("nova:initial-message", content);
        if (attachmentMeta?.length) {
          sessionStorage.setItem("nova:initial-attachments", JSON.stringify(attachmentMeta));
        }
      } catch { /* sessionStorage unavailable */ }

      navigate({ to: `/conversations/${conversation.id}`, replace: true });
    } catch {
      toast(t("conversations.createFailed", "Failed to create conversation"), "error");
      setIsCreating(false);
    }
  }, [navigate, queryClient, isCreating, t, uploadSingleFile, agent, agentId]);

  // Check for starter message from explore page or session storage
  useEffect(() => {
    try {
      const starterMessage = sessionStorage.getItem("nova:starter-message");
      if (starterMessage) {
        sessionStorage.removeItem("nova:starter-message");
        const files = consumePendingFiles();
        createAndSend(starterMessage, undefined, files.length > 0 ? files : undefined);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [createAndSend]);

  // Agent-specific starters: use linked templates first, then custom starters, then defaults
  const customStarters: string[] = agent?.starters?.filter((s: string) => s?.trim()) ?? [];
  const hasLinkedTemplates = linkedTemplates.length > 0;
  const agentStarters: string[] = customStarters.length > 0
    ? customStarters
    : [
        t("agents.testSample1", { defaultValue: "Introduce yourself" }),
        t("agents.testSample2", { defaultValue: "What can you help me with?" }),
        t("agents.testSample3", { defaultValue: "Give me an example of your work" }),
        t("agents.testSample4", { defaultValue: "What are your limitations?" }),
      ];

  // Default starters if no templates exist
  const defaultStarters = [
    t("home.starterPrompt1", "Explain quantum computing in simple terms"),
    t("home.starterPrompt2", "Help me write a Python script"),
    t("home.starterPrompt3", "What are the best practices for React?"),
    t("home.starterPrompt4", "Summarize the latest AI research"),
  ];

  const hasTemplateStarters = !agent && starters.length > 0;

  const handleTemplateClick = (tmpl: ExploreTemplate) => {
    if (tmpl.inputs?.length) {
      setSelectedTemplate(tmpl);
      return;
    }
    createAndSend(tmpl.content);
  };

  const handleTemplateSubmit = (resolvedMessage: string, files?: File[]) => {
    if (files?.length) {
      setPendingFiles(files);
    }
    setSelectedTemplate(null);
    const pendingFiles = consumePendingFiles();
    createAndSend(resolvedMessage, undefined, pendingFiles.length > 0 ? pendingFiles : undefined);
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              {agent ? <Bot className="h-6 w-6 text-primary" /> : <Sparkles className="h-6 w-6 text-primary" />}
            </div>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">
            {agent ? agent.name : t("conversations.newTitle", "New Conversation")}
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            {agent?.description ?? t("conversations.newDescription", "Start a conversation with an AI assistant")}
          </p>

          {/* Loading overlay */}
          {isCreating && (
            <div className="flex items-center justify-center gap-2 py-4 text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t("conversations.creating", "Creating conversation...")}</span>
            </div>
          )}

          {/* Conversation Starters */}
          {!isCreating && (
            <>
              {agent ? (
                <>
                  {/* Rich linked templates */}
                  {hasLinkedTemplates && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {linkedTemplates.map((tmpl) => {
                        const Icon = tmpl.icon;
                        return (
                          <button
                            key={tmpl.id}
                            onClick={() => handleTemplateClick(tmpl)}
                            className="text-left p-3 rounded-xl bg-surface-secondary border border-border hover:bg-surface-tertiary hover:border-border-strong transition-colors group"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`h-6 w-6 rounded-md ${tmpl.bgColor} flex items-center justify-center`}>
                                <Icon className={`h-3 w-3 ${tmpl.color}`} aria-hidden="true" />
                              </div>
                              <p className="text-xs font-medium text-text truncate">{tmpl.name}</p>
                              {tmpl.inputs?.length && (
                                <ArrowRight className="h-3 w-3 text-text-tertiary ml-auto shrink-0 transition-transform group-hover:translate-x-0.5" />
                              )}
                            </div>
                            <p className="text-[11px] text-text-tertiary line-clamp-2 pl-8">
                              {tmpl.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Plain text starters */}
                  {!hasLinkedTemplates && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {agentStarters.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => createAndSend(prompt)}
                          className="text-left text-xs p-3 rounded-xl bg-surface-secondary border border-border text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Show plain starters below linked templates if both exist */}
                  {hasLinkedTemplates && customStarters.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {customStarters.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => createAndSend(prompt)}
                          className="text-left text-xs p-3 rounded-xl bg-surface-secondary border border-border text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : hasTemplateStarters ? (
                <div className="space-y-3">
                  <p className="text-xs text-text-tertiary">
                    <FileText className="h-3 w-3 inline mr-1" aria-hidden="true" />
                    {t("conversations.fromPromptLibrary", "From your prompt library")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {starters.map((template: any) => (
                      <button
                        key={template.id}
                        onClick={() => createAndSend(template.content, template.systemPrompt)}
                        className="text-left p-3 rounded-xl bg-surface-secondary border border-border hover:bg-surface-tertiary hover:border-border-strong transition-colors group"
                      >
                        <p className="text-xs font-medium text-text mb-0.5 truncate">
                          {template.name}
                        </p>
                        <p className="text-[11px] text-text-tertiary line-clamp-2">
                          {template.description ?? template.content?.slice(0, 80)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {defaultStarters.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => createAndSend(prompt)}
                      className="text-left text-xs p-3 rounded-xl bg-surface-secondary border border-border text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <MessageInput onSend={(content, files) => createAndSend(content, undefined, files)} disabled={isCreating} />

      <TemplateInputDialog
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        template={selectedTemplate}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
}
