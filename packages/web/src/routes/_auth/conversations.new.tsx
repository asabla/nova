import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ChevronDown, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { MessageInput } from "../../components/chat/MessageInput";
import { ModelCapabilityBadges } from "../../components/ui/ModelCapabilityBadges";

export const Route = createFileRoute("/_auth/conversations/new")({
  component: NewConversationPage,
});

function NewConversationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("");

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<any>("/api/workspaces"),
    staleTime: 60_000,
  });

  // Load conversation starters from prompt templates (story #182)
  const { data: starterTemplates } = useQuery({
    queryKey: ["prompts", "starters"],
    queryFn: () => api.get<any>("/api/prompts?category=starter&limit=8"),
    staleTime: 60_000,
  });

  const models = (modelsData as any)?.data ?? [];
  const workspaces = (workspacesData as any)?.data ?? [];
  const starters = (starterTemplates as any)?.data ?? [];

  // Check for starter message from explore page or session storage
  useEffect(() => {
    try {
      const starterMessage = sessionStorage.getItem("nova:starter-message");
      if (starterMessage) {
        sessionStorage.removeItem("nova:starter-message");
        createAndSend(starterMessage);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const createAndSend = useCallback(async (content: string, systemPrompt?: string) => {
    const payload: any = { title: content.slice(0, 100) };
    if (selectedModel) payload.modelId = selectedModel;
    if (selectedWorkspace) payload.workspaceId = selectedWorkspace;
    if (systemPrompt) payload.systemPrompt = systemPrompt;

    const conversation = await api.post<{ id: string }>("/api/conversations", payload);

    queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });

    // Store the initial message so the conversation page can auto-send it
    try {
      sessionStorage.setItem("nova:initial-message", content);
    } catch { /* sessionStorage unavailable */ }

    navigate({ to: `/conversations/${conversation.id}`, replace: true });
  }, [navigate, queryClient, selectedModel, selectedWorkspace]);

  // Default starters if no templates exist
  const defaultStarters = [
    "Explain quantum computing in simple terms",
    "Help me write a Python script",
    "What are the best practices for React?",
    "Summarize the latest AI research",
  ];

  const hasTemplateStarters = starters.length > 0;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">{t("conversations.newTitle")}</h2>
          <p className="text-sm text-text-secondary mb-4">{t("conversations.newDescription")}</p>

          {/* Model & Workspace selectors */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-8 pl-3 pr-7 text-xs bg-surface-secondary border border-border rounded-lg text-text appearance-none cursor-pointer"
                >
                  <option value="">Auto (default model)</option>
                  {models.map((m: any) => (
                    <option key={m.id} value={m.modelId}>{m.name}</option>
                  ))}
                  {models.length === 0 && (
                    <>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                    </>
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none" />
              </div>

              {workspaces.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedWorkspace}
                    onChange={(e) => setSelectedWorkspace(e.target.value)}
                    className="h-8 pl-3 pr-7 text-xs bg-surface-secondary border border-border rounded-lg text-text appearance-none cursor-pointer"
                  >
                    <option value="">No workspace</option>
                    {workspaces.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none" />
                </div>
              )}
            </div>

            {/* Show capability badges for selected model */}
            {(() => {
              const selected = models.find((m: any) => m.modelId === selectedModel);
              const caps: string[] = selected?.capabilities ?? [];
              return caps.length > 0 ? (
                <ModelCapabilityBadges capabilities={caps} compact className="justify-center" />
              ) : null;
            })()}
          </div>

          {/* Conversation Starters */}
          {hasTemplateStarters ? (
            <div className="space-y-3">
              <p className="text-xs text-text-tertiary">
                <FileText className="h-3 w-3 inline mr-1" />
                From your prompt library
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
        </div>
      </div>

      <MessageInput onSend={(content) => createAndSend(content)} />
    </div>
  );
}
