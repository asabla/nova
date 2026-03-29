import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Settings, Lock, Users, Globe, Database, Search, Check } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select, type SelectOption } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { ModelCapabilityBadges } from "../ui/ModelCapabilityBadges";
import { toast } from "../ui/Toast";

interface ConversationSettingsProps {
  conversationId: string;
  conversation: any;
  open: boolean;
  onClose: () => void;
}

export function ConversationSettings({ conversationId, conversation, open, onClose }: ConversationSettingsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const [systemPrompt, setSystemPrompt] = useState(conversation?.systemPrompt ?? "");
  const [model, setModel] = useState(conversation?.modelId ?? "");
  const [visibility, setVisibility] = useState(conversation?.visibility ?? "private");
  const [temperature, setTemperature] = useState(conversation?.modelParams?.temperature ?? 0.7);
  const [topP, setTopP] = useState(conversation?.modelParams?.topP ?? 1);
  const [maxTokens, setMaxTokens] = useState(conversation?.modelParams?.maxTokens ?? 4096);
  const [frequencyPenalty, setFrequencyPenalty] = useState(conversation?.modelParams?.frequencyPenalty ?? 0);
  const [presencePenalty, setPresencePenalty] = useState(conversation?.modelParams?.presencePenalty ?? 0);

  useEffect(() => {
    if (conversation) {
      setSystemPrompt(conversation.systemPrompt ?? "");
      setModel(conversation.modelId ?? "");
      setVisibility(conversation.visibility ?? "private");
      const params = conversation.modelParams ?? {};
      setTemperature(params.temperature ?? 0.7);
      setTopP(params.topP ?? 1);
      setMaxTokens(params.maxTokens ?? 4096);
      setFrequencyPenalty(params.frequencyPenalty ?? 0);
      setPresencePenalty(params.presencePenalty ?? 0);
    }
  }, [conversation]);

  const [knowledgeSearch, setKnowledgeSearch] = useState("");

  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });

  // Fetch attached knowledge collections
  const { data: attachedData } = useQuery({
    queryKey: queryKeys.conversations.knowledge(conversationId),
    queryFn: () => api.get<any>(`/api/conversations/${conversationId}/knowledge`),
    enabled: open,
  });

  // Fetch all available knowledge collections
  const { data: allCollectionsData } = useQuery({
    queryKey: queryKeys.knowledge.list(),
    queryFn: () => api.get<any>("/api/knowledge?limit=100"),
    staleTime: 30_000,
    enabled: open,
  });

  const attachedCollections: { knowledgeCollectionId: string; name: string; description: string | null; documentCount: number }[] = (attachedData as any)?.data ?? [];
  const allCollections: { id: string; name: string; description: string | null }[] = (allCollectionsData as any)?.data ?? [];
  const attachedIds = new Set(attachedCollections.map((c) => c.knowledgeCollectionId));

  const filteredCollections = useMemo(
    () => knowledgeSearch
      ? allCollections.filter((c) => c.name.toLowerCase().includes(knowledgeSearch.toLowerCase()))
      : allCollections,
    [allCollections, knowledgeSearch],
  );

  const attachKnowledge = useMutation({
    mutationFn: (knowledgeCollectionId: string) =>
      api.post(`/api/conversations/${conversationId}/knowledge`, { knowledgeCollectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.knowledge(conversationId) });
    },
  });

  const detachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.delete(`/api/conversations/${conversationId}/knowledge/${collectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.knowledge(conversationId) });
    },
  });

  const update = useMutation({
    mutationFn: (data: any) => api.patch(`/api/conversations/${conversationId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      toast(t("settings.saved", { defaultValue: "Settings saved" }), "success");
      onClose();
    },
    onError: () => {
      toast(t("errors.settingsFailed", { defaultValue: "Failed to save settings" }), "error");
    },
  });

  const handleSave = () => {
    update.mutate({
      systemPrompt,
      modelId: model || null,
      visibility,
      modelParams: { temperature, topP, maxTokens, frequencyPenalty, presencePenalty },
    });
  };

  const models = (modelsData as any)?.data ?? [];

  const visibilityOptions = [
    { value: "private", label: t("settings.private", { defaultValue: "Private" }), icon: Lock, desc: t("settings.privateDesc", { defaultValue: "Only you" }) },
    { value: "team", label: t("settings.team", { defaultValue: "Team" }), icon: Users, desc: t("settings.teamDesc", { defaultValue: "Your team members" }) },
    { value: "public", label: t("settings.public", { defaultValue: "Public" }), icon: Globe, desc: t("settings.publicDesc", { defaultValue: "Anyone with link" }) },
  ];

  return (
    <div
      className={clsx(
        "fixed right-0 top-0 h-full w-full sm:w-80 bg-surface border-l border-border shadow-lg z-40 transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.conversationSettings", { defaultValue: "Conversation Settings" })}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <span className="text-sm font-medium text-text">{t("settings.conversationSettings", { defaultValue: "Conversation Settings" })}</span>
        </div>
        <button onClick={onClose} className="text-text-tertiary hover:text-text p-1 rounded" aria-label={t("actions.close", { defaultValue: "Close" })}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto h-[calc(100%-56px-56px)]">
        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">{t("settings.visibility", { defaultValue: "Visibility" })}</label>
          <div className="flex gap-1">
            {visibilityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVisibility(opt.value)}
                className={clsx(
                  "flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg border text-xs transition-colors",
                  visibility === opt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-text-tertiary hover:border-border-strong",
                )}
              >
                <opt.icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <Select
            label={t("settings.model", { defaultValue: "Model" })}
            value={model}
            onChange={(val) => setModel(val)}
            placeholder={t("settings.orgDefault", { defaultValue: "Organization default" })}
            size="sm"
            options={[
              { value: "", label: t("settings.orgDefault", { defaultValue: "Organization default" }) },
              ...models.map((m: any): SelectOption => ({ value: m.modelId, label: m.name })),
            ]}
          />
          {(() => {
            const selected = models.find((m: any) => m.modelId === model);
            const caps: string[] = selected?.capabilities ?? [];
            return caps.length > 0 ? (
              <ModelCapabilityBadges capabilities={caps} className="mt-1.5" />
            ) : null;
          })()}
        </div>

        {/* System Prompt */}
        <Textarea
          label={t("settings.systemPrompt", { defaultValue: "System Prompt" })}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          placeholder={t("settings.systemPromptPlaceholder", { defaultValue: "You are a helpful assistant..." })}
          className="w-full bg-surface-secondary resize-none"
        />

        {/* Knowledge Collections */}
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              {t("settings.knowledgeCollections", { defaultValue: "Knowledge Collections" })}
            </span>
          </label>
          {attachedCollections.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {attachedCollections.map((c) => (
                <span
                  key={c.knowledgeCollectionId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                >
                  {c.name}
                  <button
                    onClick={() => detachKnowledge.mutate(c.knowledgeCollectionId)}
                    className="hover:text-primary/70 ml-0.5"
                    aria-label={`Remove ${c.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative mb-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
            <input
              type="text"
              value={knowledgeSearch}
              onChange={(e) => setKnowledgeSearch(e.target.value)}
              placeholder={t("settings.searchCollections", { defaultValue: "Search collections..." })}
              className="w-full h-8 pl-7 pr-3 text-xs bg-surface-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder:text-text-tertiary"
            />
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-surface-secondary">
            {filteredCollections.length === 0 ? (
              <p className="text-xs text-text-tertiary p-2 text-center">
                {allCollections.length === 0
                  ? t("settings.noCollections", { defaultValue: "No knowledge collections" })
                  : t("settings.noMatch", { defaultValue: "No matches" })}
              </p>
            ) : (
              filteredCollections.map((c) => {
                const isAttached = attachedIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => isAttached ? detachKnowledge.mutate(c.id) : attachKnowledge.mutate(c.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-hover text-xs transition-colors"
                  >
                    <span className={clsx(
                      "flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center",
                      isAttached ? "bg-primary border-primary text-white" : "border-border",
                    )}>
                      {isAttached && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate text-text">{c.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">{t("settings.temperature", { defaultValue: "Temperature" })}</label>
            <span className="text-xs text-text-tertiary">{temperature}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-text-tertiary">
            <span>{t("settings.precise", { defaultValue: "Precise" })}</span>
            <span>{t("settings.creative", { defaultValue: "Creative" })}</span>
          </div>
        </div>

        {/* Top P */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">{t("settings.topP", { defaultValue: "Top P" })}</label>
            <span className="text-xs text-text-tertiary">{topP}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={topP}
            onChange={(e) => setTopP(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {/* Max Tokens */}
        <Input
          label={t("settings.maxTokens", { defaultValue: "Max Tokens" })}
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
          min={1}
          max={200000}
          className="w-full h-9 bg-surface-secondary"
        />

        {/* Frequency Penalty */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">{t("settings.frequencyPenalty", { defaultValue: "Frequency Penalty" })}</label>
            <span className="text-xs text-text-tertiary">{frequencyPenalty}</span>
          </div>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={frequencyPenalty}
            onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {/* Presence Penalty */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">{t("settings.presencePenalty", { defaultValue: "Presence Penalty" })}</label>
            <span className="text-xs text-text-tertiary">{presencePenalty}</span>
          </div>
          <input
            type="range"
            min="-2"
            max="2"
            step="0.1"
            value={presencePenalty}
            onChange={(e) => setPresencePenalty(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <Button variant="primary" size="sm" className="w-full" onClick={handleSave} loading={update.isPending}>
          {t("settings.save", { defaultValue: "Save Settings" })}
        </Button>
      </div>
    </div>
  );
}
