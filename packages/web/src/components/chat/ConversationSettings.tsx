import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Settings, Eye, EyeOff, Globe, Lock, Users } from "lucide-react";
import { clsx } from "clsx";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../ui/Button";
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
  const [systemPrompt, setSystemPrompt] = useState(conversation?.systemPrompt ?? "");
  const [model, setModel] = useState(conversation?.modelId ?? "gpt-4o");
  const [visibility, setVisibility] = useState(conversation?.visibility ?? "private");
  const [temperature, setTemperature] = useState(conversation?.modelParams?.temperature ?? 0.7);
  const [topP, setTopP] = useState(conversation?.modelParams?.topP ?? 1);
  const [maxTokens, setMaxTokens] = useState(conversation?.modelParams?.maxTokens ?? 4096);
  const [frequencyPenalty, setFrequencyPenalty] = useState(conversation?.modelParams?.frequencyPenalty ?? 0);
  const [presencePenalty, setPresencePenalty] = useState(conversation?.modelParams?.presencePenalty ?? 0);

  useEffect(() => {
    if (conversation) {
      setSystemPrompt(conversation.systemPrompt ?? "");
      setModel(conversation.modelId ?? "gpt-4o");
      setVisibility(conversation.visibility ?? "private");
      const params = conversation.modelParams ?? {};
      setTemperature(params.temperature ?? 0.7);
      setTopP(params.topP ?? 1);
      setMaxTokens(params.maxTokens ?? 4096);
      setFrequencyPenalty(params.frequencyPenalty ?? 0);
      setPresencePenalty(params.presencePenalty ?? 0);
    }
  }, [conversation]);

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (data: any) => api.patch(`/api/conversations/${conversationId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      toast("Settings saved", "success");
    },
  });

  const handleSave = () => {
    update.mutate({
      systemPrompt,
      modelId: model,
      visibility,
      modelParams: { temperature, topP, maxTokens, frequencyPenalty, presencePenalty },
    });
    onClose();
  };

  const models = (modelsData as any)?.data ?? [];

  const visibilityOptions = [
    { value: "private", label: "Private", icon: Lock, desc: "Only you" },
    { value: "team", label: "Team", icon: Users, desc: "Your team members" },
    { value: "public", label: "Public", icon: Globe, desc: "Anyone with link" },
  ];

  return (
    <div
      className={clsx(
        "fixed right-0 top-0 h-full w-80 bg-surface border-l border-border shadow-lg z-40 transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-text-secondary" />
          <span className="text-sm font-medium text-text">Conversation Settings</span>
        </div>
        <button onClick={onClose} className="text-text-tertiary hover:text-text p-1 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto h-[calc(100%-56px-56px)]">
        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">Visibility</label>
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
                <opt.icon className="h-3.5 w-3.5" />
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-surface-secondary border border-border rounded-lg text-text"
          >
            {models.length > 0 ? (
              models.map((m: any) => (
                <option key={m.id} value={m.modelId}>{m.name}</option>
              ))
            ) : (
              <>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-haiku-3.5">Claude Haiku 3.5</option>
              </>
            )}
          </select>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            placeholder="You are a helpful assistant..."
            className="w-full px-3 py-2 text-sm bg-surface-secondary border border-border rounded-lg text-text placeholder:text-text-tertiary focus:outline-primary resize-none"
          />
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">Temperature</label>
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
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Top P */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">Top P</label>
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
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">Max Tokens</label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
            min={1}
            max={200000}
            className="w-full h-9 px-3 text-sm bg-surface-secondary border border-border rounded-lg text-text"
          />
        </div>

        {/* Frequency Penalty */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">Frequency Penalty</label>
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
            <label className="text-xs font-medium text-text">Presence Penalty</label>
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
          Save Settings
        </Button>
      </div>
    </div>
  );
}
