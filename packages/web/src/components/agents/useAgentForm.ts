import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "../ui/Toast";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { getAgentColor } from "../../lib/agent-appearance";

export interface AgentForm {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  visibility: "private" | "team" | "org" | "public";
  toolApprovalMode: "auto" | "always-ask" | "never";
  memoryScope: "per-user" | "per-conversation" | "global";
  maxSteps: number;
  timeoutSeconds: number;
  starters: string[];
}

export interface TestMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

const DEFAULT_FORM: AgentForm = {
  name: "",
  description: "",
  systemPrompt: "",
  modelId: "",
  visibility: "private",
  toolApprovalMode: "always-ask",
  memoryScope: "per-user",
  maxSteps: 10,
  timeoutSeconds: 300,
  starters: [],
};

export function useAgentForm(options: { mode: "create" | "edit"; agentId?: string }) {
  const { mode, agentId } = options;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Form state ---
  const [form, setForm] = useState<AgentForm>(DEFAULT_FORM);
  const savedFormRef = useRef<AgentForm>(DEFAULT_FORM);

  const setField = useCallback(<K extends keyof AgentForm>(key: K, value: AgentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // --- Agent query (edit mode) ---
  const {
    data: agent,
    isLoading: agentLoading,
    isError: agentError,
    refetch: refetchAgent,
  } = useQuery({
    queryKey: ["agents", agentId],
    queryFn: () => api.get<any>(`/api/agents/${agentId}`),
    enabled: mode === "edit" && !!agentId,
  });

  useEffect(() => {
    if (agent) {
      const loaded: AgentForm = {
        name: agent.name ?? "",
        description: agent.description ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        modelId: agent.modelId ?? "",
        visibility: agent.visibility ?? "private",
        toolApprovalMode: agent.toolApprovalMode ?? "always-ask",
        memoryScope: agent.memoryScope ?? "per-user",
        maxSteps: agent.maxSteps ?? 10,
        timeoutSeconds: agent.timeoutSeconds ?? 300,
        starters: agent.starters ?? [],
      };
      setForm(loaded);
      savedFormRef.current = loaded;
    }
  }, [agent]);

  // --- Models ---
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });
  const models: any[] = (modelsData as any)?.data ?? [];

  // --- Dirty tracking ---
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  // --- Agent color ---
  const agentColor = getAgentColor({
    id: agentId,
    name: form.name,
    avatarUrl: agent?.avatarUrl,
  });

  // --- Mutations (edit mode) ---
  const updateMutation = useMutation({
    mutationFn: (data: Partial<AgentForm> & { avatarUrl?: string }) =>
      api.patch(`/api/agents/${agentId}`, data),
    onSuccess: () => {
      toast.success(t("agents.updated", { defaultValue: "Agent updated" }));
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      savedFormRef.current = { ...form };
    },
    onError: (err: any) =>
      toast.error(err.message ?? t("agents.updateFailed", { defaultValue: "Update failed" })),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/agents/${agentId}`),
    onSuccess: () => {
      toast.success(t("agents.deleted", { defaultValue: "Agent deleted" }));
      navigate({ to: "/agents" });
    },
    onError: (err: any) =>
      toast.error(err.message ?? t("agents.deleteFailed", { defaultValue: "Delete failed" })),
  });

  const cloneMutation = useMutation({
    mutationFn: () =>
      api.post("/api/agents", {
        name: `${form.name} (Copy)`,
        description: form.description,
        systemPrompt: form.systemPrompt,
        visibility: "private",
        toolApprovalMode: form.toolApprovalMode,
        memoryScope: form.memoryScope,
      }),
    onSuccess: (data: any) => {
      toast.success(t("agents.cloned", { defaultValue: "Agent cloned" }));
      navigate({ to: "/agents/$id", params: { id: data.id } });
    },
    onError: (err: any) =>
      toast.error(err.message ?? t("agents.cloneFailed", { defaultValue: "Clone failed" })),
  });

  // --- Create (create mode) ---
  const [creating, setCreating] = useState(false);
  // Local tool/knowledge selection for create mode (before agent exists)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectedStarterTemplateIds, setSelectedStarterTemplateIds] = useState<string[]>([]);

  const toggleTool = useCallback((toolId: string) => {
    setSelectedToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    );
  }, []);

  const toggleCollection = useCallback((collectionId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId],
    );
  }, []);

  const toggleStarterTemplate = useCallback((templateId: string) => {
    setSelectedStarterTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId],
    );
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error(t("agents.nameRequired", { defaultValue: "Agent name is required" }));
      return;
    }
    setCreating(true);
    try {
      const result = await api.post<any>("/api/agents", form);
      const newId = result.id ?? result.data?.id;

      if (newId && selectedToolIds.length > 0) {
        await Promise.allSettled(
          selectedToolIds.map((toolId) => api.post(`/api/agents/${newId}/tools`, { toolId })),
        );
      }
      if (newId && selectedCollectionIds.length > 0) {
        await Promise.allSettled(
          selectedCollectionIds.map((collectionId) =>
            api.post(`/api/agents/${newId}/knowledge`, { knowledgeCollectionId: collectionId }),
          ),
        );
      }
      if (newId && selectedStarterTemplateIds.length > 0) {
        await Promise.allSettled(
          selectedStarterTemplateIds.map((promptTemplateId, index) =>
            api.post(`/api/agents/${newId}/starters`, { promptTemplateId, sortOrder: index }),
          ),
        );
      }

      toast.success(t("agents.created", { defaultValue: "Agent created successfully" }));
      navigate({ to: newId ? `/agents/${newId}` : "/agents" });
    } catch (err: any) {
      toast.error(err.message ?? t("agents.createFailed", { defaultValue: "Failed to create agent" }));
    } finally {
      setCreating(false);
    }
  };

  // --- Save (dispatches to create or update) ---
  const save = mode === "create" ? handleCreate : () => updateMutation.mutate(form);
  const isSaving = mode === "create" ? creating : updateMutation.isPending;

  // --- Preview chat (full agent workflow) ---
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [previewMessages, setPreviewMessages] = useState<TestMessage[]>([]);
  const [previewInput, setPreviewInput] = useState("");
  const [isCreatingPreview, setIsCreatingPreview] = useState(false);
  const promptAtChatStartRef = useRef(form.systemPrompt);

  const configChangedSinceChat =
    previewMessages.length > 0 && form.systemPrompt !== promptAtChatStartRef.current;

  const resetPreview = useCallback(() => {
    // Fire-and-forget delete the temp conversation
    if (previewConversationId) {
      api.delete(`/api/conversations/${previewConversationId}`).catch(() => {});
    }
    setPreviewConversationId(null);
    setPreviewMessages([]);
    setPreviewInput("");
    promptAtChatStartRef.current = form.systemPrompt;
  }, [form.systemPrompt, previewConversationId]);

  const sendPreviewMessage = async (
    overrideInput?: string,
  ): Promise<{ conversationId: string; messages: Array<{ role: string; content: string }> } | null> => {
    const msg = (overrideInput ?? previewInput).trim();
    if (!msg || isCreatingPreview) return null;
    setPreviewInput("");
    setIsCreatingPreview(true);

    if (previewMessages.length === 0) {
      promptAtChatStartRef.current = form.systemPrompt;
    }

    try {
      // Create conversation if none exists
      let convId = previewConversationId;
      if (!convId) {
        const conv = await api.post<any>("/api/conversations", {
          systemPrompt: form.systemPrompt || undefined,
          modelId: form.modelId || undefined,
        });
        convId = conv.id ?? conv.data?.id;
        setPreviewConversationId(convId!);
      }

      // Post user message to DB
      await api.post(`/api/conversations/${convId}/messages`, {
        content: msg,
        senderType: "user",
      });

      // Add to local display
      const updatedMessages: TestMessage[] = [...previewMessages, { role: "user", content: msg }];
      setPreviewMessages(updatedMessages);

      // Build message history for the stream
      const apiMessages = [
        ...(form.systemPrompt ? [{ role: "system", content: form.systemPrompt }] : []),
        ...updatedMessages
          .filter((m) => m.role !== "error")
          .map((m) => ({ role: m.role, content: m.content })),
      ];

      return { conversationId: convId!, messages: apiMessages };
    } catch (err: any) {
      setPreviewMessages((prev) => [
        ...prev,
        { role: "error", content: err.message ?? t("agents.testFailed", { defaultValue: "Test failed" }) },
      ]);
      return null;
    } finally {
      setIsCreatingPreview(false);
    }
  };

  const addAssistantMessage = useCallback((content: string) => {
    setPreviewMessages((prev) => [...prev, { role: "assistant", content }]);
  }, []);

  // --- AI prompt generation ---
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const generatePrompt = async () => {
    setIsGeneratingPrompt(true);
    try {
      const defaultModel = models[0]?.modelIdExternal ?? models[0]?.id ?? "gpt-4o";
      const hasExisting = form.systemPrompt.trim().length > 0;
      const needsName = !form.name.trim();
      const needsDescription = !form.description.trim();
      const needsStarters = form.starters.filter((s) => s.trim()).length === 0;
      const needsJson = needsName || needsDescription || needsStarters;

      const jsonFields = [
        `"systemPrompt": "the system prompt"`,
        needsName ? `"name": "short agent name (2-4 words)"` : null,
        needsDescription ? `"description": "one-sentence summary"` : null,
        needsStarters ? `"starters": ["4 short conversation starter prompts relevant to this agent"]` : null,
      ].filter(Boolean).join(", ");

      let metaPrompt: string;
      if (hasExisting) {
        metaPrompt = `You are an expert at crafting AI agent system prompts. Improve the following system prompt for an agent named "${form.name}"${form.description ? ` described as: "${form.description}"` : ""}. Make it more specific, structured, and effective while preserving the user's intent.`;
        if (needsJson) {
          metaPrompt += `\n\nRespond with a JSON object: { ${jsonFields} }.`;
        } else {
          metaPrompt += ` Return ONLY the improved system prompt, no explanation.`;
        }
        metaPrompt += `\n\nCurrent prompt:\n${form.systemPrompt}`;
      } else {
        const context = form.name
          ? `for an agent named "${form.name}"${form.description ? ` described as: "${form.description}"` : ""}`
          : form.description
            ? `for an agent described as: "${form.description}"`
            : "for a general-purpose AI assistant";
        metaPrompt = `You are an expert at crafting AI agent system prompts. Create a detailed, well-structured system prompt ${context}. The prompt should clearly define the agent's role, capabilities, tone, and behavior guidelines.`;
        if (needsJson) {
          metaPrompt += `\n\nRespond with a JSON object: { ${jsonFields} }.`;
        } else {
          metaPrompt += ` Return ONLY the system prompt, no explanation.`;
        }
      }

      const result = await api.post<any>("/v1/chat/completions", {
        model: form.modelId || defaultModel,
        messages: [{ role: "user", content: metaPrompt }],
      });
      const content = result.choices?.[0]?.message?.content;
      if (!content) return;

      if (needsJson) {
        // Try to parse JSON response
        try {
          // Extract JSON from the response (handles markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.systemPrompt) setField("systemPrompt", parsed.systemPrompt);
            if (needsName && parsed.name) setField("name", parsed.name);
            if (needsDescription && parsed.description) setField("description", parsed.description);
            if (needsStarters && Array.isArray(parsed.starters) && parsed.starters.length > 0) {
              setField("starters", parsed.starters.filter((s: any) => typeof s === "string" && s.trim()));
            }
          } else {
            // Fallback: treat entire response as system prompt
            setField("systemPrompt", content);
          }
        } catch {
          // JSON parse failed, use as plain system prompt
          setField("systemPrompt", content);
        }
      } else {
        setField("systemPrompt", content);
      }
    } catch (err: any) {
      toast.error(
        err.message ?? t("agents.generateFailed", { defaultValue: "Failed to generate prompt" }),
      );
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  return {
    // Form
    form,
    setField,
    setForm,
    isDirty,
    save,
    isSaving,
    // Agent data
    agent,
    agentLoading,
    agentError,
    refetchAgent,
    agentColor,
    models,
    mode,
    // Mutations (edit)
    updateMutation,
    deleteMutation,
    cloneMutation,
    // Create-mode tool/knowledge/starter selection
    selectedToolIds,
    selectedCollectionIds,
    selectedStarterTemplateIds,
    toggleTool,
    toggleCollection,
    toggleStarterTemplate,
    // Preview chat
    previewConversationId,
    previewMessages,
    previewInput,
    setPreviewInput,
    sendPreviewMessage,
    resetPreview,
    addAssistantMessage,
    isCreatingPreview,
    configChangedSinceChat,
    // AI prompt
    isGeneratingPrompt,
    generatePrompt,
    // Navigation
    navigate,
  };
}

export type UseAgentFormReturn = ReturnType<typeof useAgentForm>;
