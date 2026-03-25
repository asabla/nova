import { useState } from "react";
import {
  Settings2,
  Wrench,
  BookOpen,
  Globe,
  Code2,
  Link2,
  FileText,
  Search,
  Users,
  Sparkles,
  Loader2,
  Plus,
  MessageSquare,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { Skeleton } from "../ui/Skeleton";
import { toast } from "../ui/Toast";
import { api } from "../../lib/api";
import { AGENT_COLORS } from "../../lib/agent-appearance";
import type { UseAgentFormReturn } from "./useAgentForm";

const BUILTIN_TOOLS = [
  { name: "web_search", label: "Web Search", icon: Globe, color: "#3b82f6" },
  { name: "fetch_url", label: "Fetch URL", icon: Link2, color: "#06b6d4" },
  { name: "code_execute", label: "Code Execution", icon: Code2, color: "#22c55e" },
  { name: "read_file", label: "Read File", icon: FileText, color: "#f97316" },
  { name: "search_workspace", label: "Search", icon: Search, color: "#a855f7" },
  { name: "invoke_agent", label: "Invoke Agent", icon: Users, color: "#ec4899" },
];

export function ConfigPanel({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const {
    form,
    setField,
    models,
    agentColor,
    agent,
    mode,
    updateMutation,
    isGeneratingPrompt,
    generatePrompt,
  } = ctx;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-6 stagger-children">
        {/* System Prompt */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("agents.systemPrompt", { defaultValue: "System Prompt" })}
          </h3>
          <Textarea
            value={form.systemPrompt}
            onChange={(e) => setField("systemPrompt", e.target.value)}
            placeholder={t("agents.systemPromptPlaceholder", {
              defaultValue: "You are a helpful assistant that...",
            })}
            rows={10}
            className="font-mono text-xs leading-relaxed"
          />
          <button
            onClick={generatePrompt}
            disabled={isGeneratingPrompt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${agentColor}12, ${agentColor}06)`,
              color: agentColor,
              border: `1px solid ${agentColor}20`,
            }}
          >
            {isGeneratingPrompt ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isGeneratingPrompt
              ? t("agents.generating", { defaultValue: "Generating..." })
              : form.systemPrompt.trim()
                ? t("agents.improveWithAI", { defaultValue: "Improve with AI" })
                : t("agents.generateWithAI", { defaultValue: "Generate with AI" })}
          </button>
        </section>

        <div className="border-t border-border" />

        {/* Model & Behavior */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("agents.modelAndBehavior", { defaultValue: "Model & Behavior" })}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("agents.model", { defaultValue: "Model" })}
              size="sm"
              value={form.modelId}
              onChange={(value) => setField("modelId", value)}
              options={[
                { value: "", label: t("agents.defaultModel", { defaultValue: "Default" }) },
                ...models.map((m: any) => ({
                  value: m.modelIdExternal ?? m.id,
                  label: m.name,
                })),
              ]}
            />
            <Select
              label={t("agents.visibility", { defaultValue: "Visibility" })}
              size="sm"
              value={form.visibility}
              onChange={(value) => setField("visibility", value as any)}
              options={[
                { value: "private", label: t("agents.visibilityPrivate", { defaultValue: "Private" }) },
                { value: "team", label: t("agents.visibilityTeam", { defaultValue: "Team" }) },
                { value: "org", label: t("agents.visibilityOrg", { defaultValue: "Organization" }) },
                { value: "public", label: t("agents.visibilityPublic", { defaultValue: "Public" }) },
              ]}
            />
            <Select
              label={t("agents.toolApproval", { defaultValue: "Tool Approval" })}
              size="sm"
              value={form.toolApprovalMode}
              onChange={(value) => setField("toolApprovalMode", value as any)}
              options={[
                { value: "auto", label: t("agents.toolAuto", { defaultValue: "Auto-approve" }) },
                { value: "always-ask", label: t("agents.toolAlwaysAsk", { defaultValue: "Always ask" }) },
                { value: "never", label: t("agents.toolNever", { defaultValue: "Never allow" }) },
              ]}
            />
            <Select
              label={t("agents.memoryScope", { defaultValue: "Memory Scope" })}
              size="sm"
              value={form.memoryScope}
              onChange={(value) => setField("memoryScope", value as any)}
              options={[
                { value: "per-user", label: t("agents.memoryPerUser", { defaultValue: "Per user" }) },
                {
                  value: "per-conversation",
                  label: t("agents.memoryPerConversation", { defaultValue: "Per conversation" }),
                },
                { value: "global", label: t("agents.memoryGlobal", { defaultValue: "Global" }) },
              ]}
            />
          </div>
        </section>

        <div className="border-t border-border" />

        {/* Agent Color */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
            {t("agents.agentColor", { defaultValue: "Color" })}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {AGENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  if (mode === "edit") {
                    updateMutation.mutate({ ...form, avatarUrl: `color:${c}` } as any);
                  }
                }}
                className={`h-6 w-6 rounded-full transition-all hover:scale-115 active:scale-95 ${
                  agentColor === c ? "scale-110 ring-2 ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{
                  backgroundColor: c,
                  ...(agentColor === c ? { ringColor: c, boxShadow: `0 0 0 2px var(--color-surface), 0 0 0 4px ${c}` } : {}),
                }}
                aria-label={`Select color ${c}`}
              />
            ))}
            <button
              onClick={() => {
                if (mode === "edit") {
                  updateMutation.mutate({ ...form, avatarUrl: "" } as any);
                }
              }}
              className={`h-6 px-2 rounded-full text-[10px] font-medium border transition-colors ${
                !agent?.avatarUrl?.startsWith("color:")
                  ? "border-text text-text"
                  : "border-border text-text-tertiary hover:text-text"
              }`}
            >
              Auto
            </button>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* Tools */}
        <ToolsSection ctx={ctx} />

        <div className="border-t border-border" />

        {/* Knowledge */}
        <KnowledgeSection ctx={ctx} />

        <div className="border-t border-border" />

        {/* Suggested Prompts */}
        <StartersSection ctx={ctx} />

        {/* Version info (edit only) */}
        {mode === "edit" && agent && (
          <>
            <div className="border-t border-border" />
            <div className="text-[10px] text-text-tertiary space-y-0.5">
              <p>Version: {agent.currentVersion}</p>
              <p>Created: {new Date(agent.createdAt).toLocaleDateString()}</p>
              <p>Updated: {new Date(agent.updatedAt).toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tools section — handles both create (local toggle) and edit (API attach/detach)
// ---------------------------------------------------------------------------

function ToolsSection({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const { mode } = ctx;
  const [showAvailable, setShowAvailable] = useState(false);

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
        {t("agents.tabs.tools", { defaultValue: "Tools" })}
      </h3>

      {/* Built-in tools as compact badges */}
      <div className="flex flex-wrap gap-1.5">
        {BUILTIN_TOOLS.map((bt) => {
          const Icon = bt.icon;
          return (
            <span
              key={bt.name}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-secondary border border-border text-[11px] text-text-secondary"
            >
              <Icon className="h-3 w-3" style={{ color: bt.color }} aria-hidden="true" />
              {bt.label}
            </span>
          );
        })}
        <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] text-text-tertiary">
          {t("agents.alwaysAvailable", { defaultValue: "Always available" })}
        </span>
      </div>

      {/* Custom tools */}
      {mode === "edit" ? (
        <EditModeTools agentId={ctx.form.name ? (ctx as any).agent?.id ?? "" : ""} ctx={ctx} />
      ) : (
        <CreateModeTools ctx={ctx} />
      )}
    </section>
  );
}

function EditModeTools({ ctx }: { agentId: string; ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const agentId = (ctx as any).agent?.id;
  const [showAvailable, setShowAvailable] = useState(false);

  const { data: agentTools, isLoading } = useQuery({
    queryKey: ["agents", agentId, "tools"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/tools`),
    enabled: !!agentId,
  });

  const { data: allTools } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<any>("/api/tools"),
    staleTime: 60_000,
  });

  const attachTool = useMutation({
    mutationFn: (toolId: string) => api.post(`/api/agents/${agentId}/tools`, { toolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "tools"] });
      toast.success(t("agents.toolAttached", { defaultValue: "Tool attached" }));
    },
    onError: (err: any) =>
      toast.error(err.message ?? t("agents.toolAttachFailed", { defaultValue: "Failed to attach tool" })),
  });

  const detachTool = useMutation({
    mutationFn: (toolId: string) => api.delete(`/api/agents/${agentId}/tools/${toolId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "tools"] });
      toast.success(t("agents.toolRemoved", { defaultValue: "Tool removed" }));
    },
    onError: (err: any) =>
      toast.error(err.message ?? t("agents.toolRemoveFailed", { defaultValue: "Failed to remove tool" })),
  });

  const customAttached: any[] = (agentTools as any)?.data ?? [];
  const allCustomTools: any[] = (allTools as any)?.data ?? [];
  const customAvailable = allCustomTools.filter(
    (tool: any) => !customAttached.some((at: any) => at.toolId === tool.id),
  );

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-2">
      {customAttached.length > 0 && (
        <div className="space-y-1.5">
          {customAttached.map((tool: any) => (
            <div
              key={tool.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-secondary border border-border group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-text truncate">
                  {tool.name ?? tool.toolId}
                </span>
              </div>
              <button
                onClick={() => detachTool.mutate(tool.toolId ?? tool.id)}
                className="text-[10px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("common.remove", { defaultValue: "Remove" })}
              </button>
            </div>
          ))}
        </div>
      )}

      {customAvailable.length > 0 && (
        <>
          <button
            onClick={() => setShowAvailable(!showAvailable)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("agents.attachTool", { defaultValue: "Attach tool" })}
            <span className="text-text-tertiary">({customAvailable.length})</span>
          </button>

          {showAvailable && (
            <div className="space-y-1.5">
              {customAvailable.map((tool: any) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="h-3 w-3 text-text-tertiary shrink-0" aria-hidden="true" />
                    <span className="text-xs text-text truncate">{tool.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => attachTool.mutate(tool.id)}
                    disabled={attachTool.isPending}
                    className="text-[10px] h-6 px-2"
                  >
                    {t("agents.attach", { defaultValue: "Attach" })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreateModeTools({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const { selectedToolIds, toggleTool } = ctx;
  const [showAvailable, setShowAvailable] = useState(false);

  const { data: allToolsData, isLoading } = useQuery({
    queryKey: ["tools"],
    queryFn: () => api.get<any>("/api/tools"),
    staleTime: 60_000,
  });

  const allTools: any[] = (allToolsData as any)?.data ?? [];
  const selected = allTools.filter((tool) => selectedToolIds.includes(tool.id));
  const available = allTools.filter((tool) => !selectedToolIds.includes(tool.id));

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="space-y-1.5">
          {selected.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-secondary border border-border group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-text truncate">{tool.name}</span>
              </div>
              <button
                onClick={() => toggleTool(tool.id)}
                className="text-[10px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("common.remove", { defaultValue: "Remove" })}
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <>
          <button
            onClick={() => setShowAvailable(!showAvailable)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("agents.attachTool", { defaultValue: "Attach tool" })}
            <span className="text-text-tertiary">({available.length})</span>
          </button>

          {showAvailable && (
            <div className="space-y-1.5">
              {available.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wrench className="h-3 w-3 text-text-tertiary shrink-0" aria-hidden="true" />
                    <span className="text-xs text-text truncate">{tool.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTool(tool.id)}
                    className="text-[10px] h-6 px-2"
                  >
                    {t("agents.attach", { defaultValue: "Attach" })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge section
// ---------------------------------------------------------------------------

function KnowledgeSection({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const { mode } = ctx;

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        {t("agents.tabs.knowledge", { defaultValue: "Knowledge" })}
      </h3>

      {mode === "edit" ? <EditModeKnowledge ctx={ctx} /> : <CreateModeKnowledge ctx={ctx} />}
    </section>
  );
}

function EditModeKnowledge({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const agentId = (ctx as any).agent?.id;
  const [showAvailable, setShowAvailable] = useState(false);

  const { data: agentKnowledge, isLoading } = useQuery({
    queryKey: ["agents", agentId, "knowledge"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/knowledge`),
    enabled: !!agentId,
  });

  const { data: collections } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const attachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.post(`/api/agents/${agentId}/knowledge`, { knowledgeCollectionId: collectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "knowledge"] });
      toast.success(t("agents.knowledgeConnected", { defaultValue: "Knowledge collection connected" }));
    },
    onError: (err: any) =>
      toast.error(
        err.message ?? t("agents.knowledgeConnectFailed", { defaultValue: "Failed to connect knowledge" }),
      ),
  });

  const detachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.delete(`/api/agents/${agentId}/knowledge/${collectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "knowledge"] });
      toast.success(
        t("agents.knowledgeDisconnected", { defaultValue: "Knowledge collection disconnected" }),
      );
    },
    onError: (err: any) =>
      toast.error(
        err.message ??
          t("agents.knowledgeDisconnectFailed", { defaultValue: "Failed to disconnect knowledge" }),
      ),
  });

  const allCollections: any[] = (collections as any)?.data ?? [];
  const attachedLinks: any[] = (agentKnowledge as any)?.data ?? [];
  const collectionMap = new Map(allCollections.map((c: any) => [c.id, c]));
  const attachedIds = new Set(
    attachedLinks.map((link: any) => link.knowledgeCollectionId ?? link.collectionId),
  );
  const attached = attachedLinks.map((link: any) => {
    const cId = link.knowledgeCollectionId ?? link.collectionId;
    return { ...link, _collection: collectionMap.get(cId), _id: cId };
  });
  const available = allCollections.filter((c: any) => !attachedIds.has(c.id));

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-2">
      {attached.length > 0 && (
        <div className="space-y-1.5">
          {attached.map((link: any) => (
            <div
              key={link.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-secondary border border-border group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-3 w-3 text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-text truncate">
                  {link._collection?.name ?? link._id}
                </span>
              </div>
              <button
                onClick={() => detachKnowledge.mutate(link._id)}
                className="text-[10px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("agents.disconnect", { defaultValue: "Disconnect" })}
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <>
          <button
            onClick={() => setShowAvailable(!showAvailable)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("agents.connectCollection", { defaultValue: "Connect collection" })}
            <span className="text-text-tertiary">({available.length})</span>
          </button>

          {showAvailable && (
            <div className="space-y-1.5">
              {available.map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="h-3 w-3 text-text-tertiary shrink-0" aria-hidden="true" />
                    <span className="text-xs text-text truncate">{c.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => attachKnowledge.mutate(c.id)}
                    disabled={attachKnowledge.isPending}
                    className="text-[10px] h-6 px-2"
                  >
                    {t("agents.connect", { defaultValue: "Connect" })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {attached.length === 0 && available.length === 0 && (
        <p className="text-xs text-text-tertiary">
          {t("agents.noCollections", { defaultValue: "No knowledge collections exist yet." })}
        </p>
      )}
    </div>
  );
}

function CreateModeKnowledge({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const { selectedCollectionIds, toggleCollection } = ctx;
  const [showAvailable, setShowAvailable] = useState(false);

  const { data: collectionsData, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.get<any>("/api/knowledge"),
  });

  const allCollections: any[] = (collectionsData as any)?.data ?? [];
  const selected = allCollections.filter((c) => selectedCollectionIds.includes(c.id));
  const available = allCollections.filter((c) => !selectedCollectionIds.includes(c.id));

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="space-y-1.5">
          {selected.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-secondary border border-border group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-3 w-3 text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-text truncate">{c.name}</span>
              </div>
              <button
                onClick={() => toggleCollection(c.id)}
                className="text-[10px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("agents.disconnect", { defaultValue: "Disconnect" })}
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <>
          <button
            onClick={() => setShowAvailable(!showAvailable)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("agents.connectCollection", { defaultValue: "Connect collection" })}
            <span className="text-text-tertiary">({available.length})</span>
          </button>

          {showAvailable && (
            <div className="space-y-1.5">
              {available.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-border-strong transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="h-3 w-3 text-text-tertiary shrink-0" aria-hidden="true" />
                    <span className="text-xs text-text truncate">{c.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCollection(c.id)}
                    className="text-[10px] h-6 px-2"
                  >
                    {t("agents.connect", { defaultValue: "Connect" })}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {allCollections.length === 0 && (
        <p className="text-xs text-text-tertiary">
          {t("agents.noCollections", { defaultValue: "No knowledge collections exist yet." })}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggested Prompts section
// ---------------------------------------------------------------------------

const MAX_STARTERS = 6;

function StartersSection({ ctx }: { ctx: UseAgentFormReturn }) {
  const { t } = useTranslation();
  const { form, setField, mode, agent } = ctx;
  const starters = form.starters ?? [];
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const updateStarter = (index: number, value: string) => {
    const updated = [...starters];
    updated[index] = value;
    setField("starters", updated);
  };

  const removeStarter = (index: number) => {
    setField("starters", starters.filter((_, i) => i !== index));
  };

  const addStarter = () => {
    if (starters.length < MAX_STARTERS) {
      setField("starters", [...starters, ""]);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        {t("agents.suggestedPrompts", { defaultValue: "Suggested Prompts" })}
      </h3>
      <p className="text-[11px] text-text-tertiary leading-relaxed">
        {t("agents.suggestedPromptsHint", {
          defaultValue: "Conversation starters shown when users open a chat with this agent.",
        })}
      </p>

      {/* Linked templates */}
      {mode === "create" ? (
        <CreateModeStarters ctx={ctx} showPicker={showTemplatePicker} setShowPicker={setShowTemplatePicker} />
      ) : (
        <EditModeStarters ctx={ctx} showPicker={showTemplatePicker} setShowPicker={setShowTemplatePicker} />
      )}

      {/* Plain text starters */}
      {starters.length > 0 && (
        <div className="space-y-2">
          {starters.map((starter, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <input
                type="text"
                value={starter}
                onChange={(e) => updateStarter(i, e.target.value)}
                placeholder={t("agents.starterPlaceholder", {
                  defaultValue: "e.g. Help me write a report...",
                })}
                className="flex-1 h-8 px-3 rounded-lg border border-border bg-surface text-xs text-text placeholder:text-text-tertiary transition-colors field-glow"
              />
              <button
                onClick={() => removeStarter(i)}
                className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                aria-label={t("common.remove", { defaultValue: "Remove" })}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        {starters.length < MAX_STARTERS && (
          <button
            onClick={addStarter}
            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t("agents.addStarter", { defaultValue: "Add text prompt" })}
          </button>
        )}
        <button
          onClick={() => setShowTemplatePicker(true)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Link2 className="h-3 w-3" aria-hidden="true" />
          {t("agents.linkTemplate", { defaultValue: "Link template" })}
        </button>
      </div>
    </section>
  );
}

function CreateModeStarters({ ctx, showPicker, setShowPicker }: { ctx: UseAgentFormReturn; showPicker: boolean; setShowPicker: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { selectedStarterTemplateIds, toggleStarterTemplate } = ctx;

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["prompts", "explore"],
    queryFn: () => api.get<any>("/api/prompts/explore?limit=100"),
    staleTime: 60_000,
  });

  const allTemplates: any[] = (templatesData as any)?.data ?? [];
  const selected = allTemplates.filter((t: any) => selectedStarterTemplateIds.includes(t.id));
  const available = allTemplates.filter((t: any) => !selectedStarterTemplateIds.includes(t.id));

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="space-y-1.5">
          {selected.map((tmpl: any) => (
            <div key={tmpl.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-surface-secondary group">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium text-text truncate flex-1">{tmpl.name}</span>
              <button
                onClick={() => toggleStarterTemplate(tmpl.id)}
                className="text-[10px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("agents.disconnect", { defaultValue: "Disconnect" })}
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <div className="border border-border rounded-lg p-2 space-y-1.5 max-h-48 overflow-y-auto bg-surface">
          {isLoading ? (
            <Skeleton className="h-8 w-full rounded-lg" />
          ) : available.length === 0 ? (
            <p className="text-xs text-text-tertiary p-2">{t("agents.noTemplatesAvailable", { defaultValue: "No more templates available" })}</p>
          ) : (
            available.map((tmpl: any) => (
              <div key={tmpl.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{tmpl.name}</p>
                  {tmpl.description && <p className="text-[10px] text-text-tertiary truncate">{tmpl.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleStarterTemplate(tmpl.id)} className="text-[10px] h-6 px-2">
                  {t("agents.connect", { defaultValue: "Connect" })}
                </Button>
              </div>
            ))
          )}
          <button onClick={() => setShowPicker(false)} className="text-[10px] text-text-tertiary hover:text-text mt-1">
            {t("common.close", { defaultValue: "Close" })}
          </button>
        </div>
      )}
    </div>
  );
}

function EditModeStarters({ ctx, showPicker, setShowPicker }: { ctx: UseAgentFormReturn; showPicker: boolean; setShowPicker: (v: boolean) => void }) {
  const { t } = useTranslation();
  const { agent } = ctx;
  const queryClient = useQueryClient();
  const agentId = agent?.id;

  const { data: linkedData, isLoading: linkedLoading } = useQuery({
    queryKey: ["agents", agentId, "starters"],
    queryFn: () => api.get<any>(`/api/agents/${agentId}/starters`),
    enabled: !!agentId,
  });

  const linkedTemplates: any[] = (linkedData as any)?.data ?? [];

  const linkMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/api/agents/${agentId}/starters`, { promptTemplateId: templateId, sortOrder: linkedTemplates.length }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents", agentId, "starters"] }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.delete(`/api/agents/${agentId}/starters/${templateId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents", agentId, "starters"] }),
  });

  const { data: templatesData } = useQuery({
    queryKey: ["prompts", "explore"],
    queryFn: () => api.get<any>("/api/prompts/explore?limit=100"),
    staleTime: 60_000,
    enabled: showPicker,
  });

  const allTemplates: any[] = (templatesData as any)?.data ?? [];
  const linkedIds = new Set(linkedTemplates.map((t: any) => t.id));
  const available = allTemplates.filter((t: any) => !linkedIds.has(t.id));

  return (
    <div className="space-y-2">
      {linkedLoading && <Skeleton className="h-8 w-full rounded-lg" />}

      {linkedTemplates.length > 0 && (
        <div className="space-y-1.5">
          {linkedTemplates.map((tmpl: any) => (
            <div key={tmpl.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-surface-secondary group">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium text-text truncate flex-1">{tmpl.name}</span>
              <button
                onClick={() => unlinkMutation.mutate(tmpl.id)}
                className="text-[10px] text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("agents.disconnect", { defaultValue: "Disconnect" })}
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <div className="border border-border rounded-lg p-2 space-y-1.5 max-h-48 overflow-y-auto bg-surface">
          {available.length === 0 ? (
            <p className="text-xs text-text-tertiary p-2">{t("agents.noTemplatesAvailable", { defaultValue: "No more templates available" })}</p>
          ) : (
            available.map((tmpl: any) => (
              <div key={tmpl.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-secondary transition-colors">
                <FileText className="h-3.5 w-3.5 text-text-tertiary shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{tmpl.name}</p>
                  {tmpl.description && <p className="text-[10px] text-text-tertiary truncate">{tmpl.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => linkMutation.mutate(tmpl.id)} className="text-[10px] h-6 px-2">
                  {t("agents.connect", { defaultValue: "Connect" })}
                </Button>
              </div>
            ))
          )}
          <button onClick={() => setShowPicker(false)} className="text-[10px] text-text-tertiary hover:text-text mt-1">
            {t("common.close", { defaultValue: "Close" })}
          </button>
        </div>
      )}
    </div>
  );
}
