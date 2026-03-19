import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import {
  Search,
  Globe,
  BookOpen,
  FileIcon,
  Settings2,
  ChevronDown,
  ChevronRight,
  LayoutList,
  X,
  Check,
  Plus,
  Database,
  Loader2,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Checkbox } from "../ui/Checkbox";
import { Switch } from "../ui/Switch";
import { Tabs } from "../ui/Tabs";
import { Slider } from "../ui/Slider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutputFormat = "markdown" | "structured";

export interface SourceSelection {
  webSearch: boolean;
  knowledgeCollectionIds: string[];
  fileIds: string[];
}

export interface NewResearchFormSubmitData {
  query: string;
  maxSources: number;
  maxIterations: number;
  outputFormat: OutputFormat;
  sources: SourceSelection;
}

export interface NewResearchFormProps {
  onSubmit: (data: NewResearchFormSubmitData) => void;
  isPending: boolean;
  defaultValues?: Partial<NewResearchFormSubmitData>;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface KnowledgeCollection {
  id: string;
  name: string;
  description: string | null;
  status: string;
  documentCount?: number;
}

interface UserFile {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewResearchForm({
  onSubmit,
  isPending,
  defaultValues,
  compact = false,
}: NewResearchFormProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [query, setQuery] = useState(defaultValues?.query ?? "");
  const [maxSources, setMaxSources] = useState(defaultValues?.maxSources ?? 10);
  const [maxIterations, setMaxIterations] = useState(defaultValues?.maxIterations ?? 5);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(
    defaultValues?.outputFormat ?? "structured",
  );
  const [sources, setSources] = useState<SourceSelection>(
    defaultValues?.sources ?? {
      webSearch: true,
      knowledgeCollectionIds: [],
      fileIds: [],
    },
  );

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [filesSearch, setFilesSearch] = useState("");

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ---- Data fetching ----

  const { data: knowledgeData, isLoading: isLoadingKnowledge } = useQuery({
    queryKey: ["knowledge-collections"],
    queryFn: () =>
      api.get<{ data: KnowledgeCollection[]; total: number }>("/api/knowledge?limit=100"),
    staleTime: 30_000,
  });

  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ["user-files"],
    queryFn: () =>
      api.get<{ data: UserFile[]; total: number }>("/api/files?pageSize=100"),
    staleTime: 30_000,
  });

  const collections: KnowledgeCollection[] = (knowledgeData as any)?.data ?? [];
  const files: UserFile[] = (filesData as any)?.data ?? [];

  const filteredCollections = useMemo(
    () =>
      knowledgeSearch
        ? collections.filter((c) =>
            c.name.toLowerCase().includes(knowledgeSearch.toLowerCase()),
          )
        : collections,
    [collections, knowledgeSearch],
  );

  const filteredFiles = useMemo(
    () =>
      filesSearch
        ? files.filter((f) =>
            f.filename.toLowerCase().includes(filesSearch.toLowerCase()),
          )
        : files,
    [files, filesSearch],
  );

  // ---- Helpers ----

  const selectedCollectionNames = useMemo(
    () =>
      collections
        .filter((c) => sources.knowledgeCollectionIds.includes(c.id))
        .map((c) => c.name),
    [collections, sources.knowledgeCollectionIds],
  );

  const selectedFileNames = useMemo(
    () =>
      files
        .filter((f) => sources.fileIds.includes(f.id))
        .map((f) => f.filename),
    [files, sources.fileIds],
  );

  const sourceCount =
    (sources.webSearch ? 1 : 0) +
    sources.knowledgeCollectionIds.length +
    sources.fileIds.length;

  const sourceSummary = [
    sources.webSearch ? t("research.webSearch", "Web") : null,
    sources.knowledgeCollectionIds.length > 0
      ? `${sources.knowledgeCollectionIds.length} ${t("research.collections", "collection")}${sources.knowledgeCollectionIds.length > 1 ? "s" : ""}`
      : null,
    sources.fileIds.length > 0
      ? `${sources.fileIds.length} ${t("research.files", "file")}${sources.fileIds.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" + ");

  const toggleCollection = (id: string) => {
    setSources((prev) => ({
      ...prev,
      knowledgeCollectionIds: prev.knowledgeCollectionIds.includes(id)
        ? prev.knowledgeCollectionIds.filter((x) => x !== id)
        : [...prev.knowledgeCollectionIds, id],
    }));
  };

  const toggleFile = (id: string) => {
    setSources((prev) => ({
      ...prev,
      fileIds: prev.fileIds.includes(id)
        ? prev.fileIds.filter((x) => x !== id)
        : [...prev.fileIds, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    onSubmit({
      query: query.trim(),
      maxSources,
      maxIterations,
      outputFormat,
      sources,
    });
  };

  const handleTabChange = (_tabId: string) => {
    // no-op — data is pre-fetched on mount
  };

  // ---- Source picker tabs (shared between compact dropdown and full panel) ----

  const sourceTabs = useMemo(
    () => [
      {
        id: "web",
        label: t("research.webTab", "Web"),
        icon: <Globe className="h-3.5 w-3.5" />,
      },
      {
        id: "knowledge",
        label: t("research.knowledgeTab", "Knowledge"),
        icon: <Database className="h-3.5 w-3.5" />,
      },
      {
        id: "files",
        label: t("research.filesTab", "Files"),
        icon: <FileIcon className="h-3.5 w-3.5" />,
      },
    ],
    [t],
  );

  const renderTabContent = (activeTab: string) => {
    if (activeTab === "web") {
      return (
        <div className="space-y-3">
          <Switch
            checked={sources.webSearch}
            onChange={(checked) =>
              setSources((prev) => ({ ...prev, webSearch: checked }))
            }
            label={t("research.enableWebSearch", "Web Search")}
            description={t(
              "research.webSearchDesc",
              "Search the web via SearxNG for relevant sources",
            )}
            size="sm"
          />
        </div>
      );
    }

    if (activeTab === "knowledge") {
      return (
        <div className="space-y-2">
          <Input
            placeholder={t("research.searchCollections", "Search collections...")}
            value={knowledgeSearch}
            onChange={(e) => setKnowledgeSearch(e.target.value)}
            className="h-8 text-xs"
          />
          {isLoadingKnowledge ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
            </div>
          ) : filteredCollections.length === 0 ? (
            <p className="text-xs text-text-tertiary py-4 text-center">
              {collections.length === 0
                ? t("research.noCollections", "No knowledge collections found")
                : t("research.noCollectionsMatch", "No collections match your search")}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto -mx-1 px-1 space-y-1">
              {filteredCollections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggleCollection(col.id)}
                  className={clsx(
                    "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    sources.knowledgeCollectionIds.includes(col.id)
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-surface-secondary border border-transparent",
                  )}
                >
                  <Checkbox
                    checked={sources.knowledgeCollectionIds.includes(col.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text truncate">
                      {col.name}
                    </p>
                    {col.description && (
                      <p className="text-[10px] text-text-tertiary truncate">
                        {col.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={col.status === "active" ? "success" : "warning"}
                    className="shrink-0 text-[10px]"
                  >
                    {col.status === "active" ? "Ready" : "Indexing"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "files") {
      return (
        <div className="space-y-2">
          <Input
            placeholder={t("research.searchFiles", "Search files...")}
            value={filesSearch}
            onChange={(e) => setFilesSearch(e.target.value)}
            className="h-8 text-xs"
          />
          {isLoadingFiles ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <p className="text-xs text-text-tertiary py-4 text-center">
              {files.length === 0
                ? t("research.noFiles", "No files found")
                : t("research.noFilesMatch", "No files match your search")}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto -mx-1 px-1 space-y-1">
              {filteredFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => toggleFile(file.id)}
                  className={clsx(
                    "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    sources.fileIds.includes(file.id)
                      ? "bg-primary/5 border border-primary/20"
                      : "hover:bg-surface-secondary border border-transparent",
                  )}
                >
                  <Checkbox
                    checked={sources.fileIds.includes(file.id)}
                  />
                  <FileTypeIcon contentType={file.contentType} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text truncate">
                      {file.filename}
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      {formatFileSize(file.sizeBytes)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ===========================================================================
  // COMPACT LAYOUT
  // ===========================================================================

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2.5 mt-2">
        <Textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            "research.queryPlaceholder",
            "What would you like to research in depth?",
          )}
          rows={3}
          className="text-sm resize-none"
          error={
            query.length > 0 && query.trim().length < 3
              ? t("research.queryMinLength", "Query must be at least 3 characters")
              : undefined
          }
        />

        {/* Source chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {sources.webSearch && (
            <SourceChip
              icon={<Globe className="h-2.5 w-2.5" />}
              label={t("research.webSearch", "Web")}
              onRemove={() =>
                setSources((prev) => ({ ...prev, webSearch: false }))
              }
            />
          )}
          {selectedCollectionNames.map((name, i) => (
            <SourceChip
              key={sources.knowledgeCollectionIds[i]}
              icon={<Database className="h-2.5 w-2.5" />}
              label={name}
              onRemove={() =>
                toggleCollection(sources.knowledgeCollectionIds[i])
              }
            />
          ))}
          {selectedFileNames.map((name, i) => (
            <SourceChip
              key={sources.fileIds[i]}
              icon={<FileIcon className="h-2.5 w-2.5" />}
              label={name}
              onRemove={() => toggleFile(sources.fileIds[i])}
            />
          ))}
          <button
            type="button"
            onClick={() => setSourcePickerOpen((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
              sourcePickerOpen
                ? "bg-primary/10 text-primary"
                : "bg-surface-tertiary text-text-secondary hover:text-text hover:bg-surface-secondary",
            )}
          >
            <Plus className="h-2.5 w-2.5" />
            {t("research.addSource", "Source")}
          </button>
        </div>

        {/* Compact source picker dropdown */}
        {sourcePickerOpen && (
          <div className="rounded-lg border border-border bg-surface p-3 shadow-lg">
            <Tabs
              tabs={sourceTabs}
              onTabChange={handleTabChange}
            >
              {renderTabContent}
            </Tabs>
          </div>
        )}

        {/* Advanced settings toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text transition-colors"
        >
          <Settings2 className="h-3 w-3" aria-hidden="true" />
          {t("research.advancedSettings", "Advanced settings")}
          {showAdvanced ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {showAdvanced && (
          <div className="space-y-3 p-3 rounded-lg bg-surface-secondary border border-border">
            <div className="grid grid-cols-2 gap-3">
              <Slider
                label={t("research.maxSources", "Max Sources")}
                value={maxSources}
                onChange={setMaxSources}
                min={1}
                max={50}
                step={1}
              />
              <Slider
                label={t("research.maxIterations", "Max Iterations")}
                value={maxIterations}
                onChange={setMaxIterations}
                min={1}
                max={10}
                step={1}
              />
            </div>

            <div>
              <label className="block text-xs text-text-tertiary mb-1 flex items-center gap-1">
                <LayoutList className="h-3 w-3" aria-hidden="true" />
                {t("research.outputFormat", "Output Format")}
              </label>
              <div className="flex gap-2">
                <FormatButton
                  active={outputFormat === "structured"}
                  onClick={() => setOutputFormat("structured")}
                  label={t("research.formatStructured", "Structured")}
                />
                <FormatButton
                  active={outputFormat === "markdown"}
                  onClick={() => setOutputFormat("markdown")}
                  label={t("research.formatMarkdown", "Markdown")}
                />
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="sm"
          className="w-full"
          disabled={query.trim().length < 3 || isPending}
          loading={isPending}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          {isPending
            ? t("research.starting", "Starting...")
            : t("research.startResearch", "Start Research")}
        </Button>
      </form>
    );
  }

  // ===========================================================================
  // FULL LAYOUT
  // ===========================================================================

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Gradient accent strip */}
      <div className="h-[3px] -mx-5 -mt-5 rounded-t-xl bg-gradient-to-r from-primary via-primary/70 to-primary/40" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Search className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text">
            {t("research.newTitle", "New Deep Research")}
          </h3>
          <p className="text-xs text-text-tertiary">
            {t(
              "research.newSubtitle",
              "Multi-step research across web and internal sources",
            )}
          </p>
        </div>
      </div>

      {/* Query */}
      <div>
        <Textarea
          ref={textareaRef}
          label={t("research.queryLabel", "Research Query")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            "research.queryPlaceholder",
            "What would you like to research in depth?",
          )}
          rows={4}
          className="resize-none"
          error={
            query.length > 0 && query.trim().length < 3
              ? t("research.queryMinLength", "Query must be at least 3 characters")
              : undefined
          }
        />
        <p className="text-[10px] text-text-tertiary mt-1">
          {t(
            "research.queryHint",
            "Be specific — the more context you provide, the better the research output.",
          )}
        </p>
      </div>

      {/* Source picker (tabbed panel) */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-secondary/50 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-text">
            {t("research.sources", "Sources")}
          </span>
          {sourceCount > 0 && (
            <span className="text-[10px] text-text-tertiary">{sourceSummary}</span>
          )}
        </div>
        <div className="p-4">
          <Tabs
            tabs={sourceTabs}
            onTabChange={handleTabChange}
          >
            {renderTabContent}
          </Tabs>
        </div>
      </div>

      {/* Sliders side by side */}
      <div className="grid grid-cols-2 gap-4">
        <Slider
          label={t("research.maxSources", "Max Sources")}
          value={maxSources}
          onChange={setMaxSources}
          min={1}
          max={50}
          step={1}
        />
        <Slider
          label={t("research.maxIterations", "Max Iterations")}
          value={maxIterations}
          onChange={setMaxIterations}
          min={1}
          max={10}
          step={1}
        />
      </div>

      {/* Output format cards */}
      <div>
        <label className="block text-xs font-medium text-text mb-2 flex items-center gap-1.5">
          <LayoutList className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
          {t("research.outputFormat", "Output Format")}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <FormatCard
            active={outputFormat === "structured"}
            onClick={() => setOutputFormat("structured")}
            icon={<LayoutList className="h-4 w-4" />}
            title={t("research.formatStructured", "Structured")}
            description={t(
              "research.structuredDesc",
              "Sections with summaries and key findings",
            )}
          />
          <FormatCard
            active={outputFormat === "markdown"}
            onClick={() => setOutputFormat("markdown")}
            icon={<BookOpen className="h-4 w-4" />}
            title={t("research.formatMarkdown", "Markdown")}
            description={t("research.markdownDesc", "Flowing prose with headings and citations")}
          />
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={query.trim().length < 3 || isPending}
        loading={isPending}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        {isPending
          ? t("research.starting", "Starting...")
          : t("research.startResearch", "Start Research")}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceChip({
  icon,
  label,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary pl-2 pr-1 py-0.5 text-[10px] font-medium max-w-[120px]">
      {icon}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
        aria-label={`Remove ${label}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function FormatButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 px-2 py-1.5 rounded-lg border text-xs transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-border bg-surface text-text-secondary hover:border-border-strong",
      )}
    >
      {label}
    </button>
  );
}

function FormatCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-secondary",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={clsx(active ? "text-primary" : "text-text-tertiary")}>
          {icon}
        </span>
        <span
          className={clsx(
            "text-xs font-medium",
            active ? "text-primary" : "text-text",
          )}
        >
          {title}
        </span>
        {active && <Check className="h-3 w-3 text-primary ml-auto" />}
      </div>
      <p className="text-[10px] text-text-tertiary leading-snug">{description}</p>
    </button>
  );
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  const color = contentType.startsWith("image/")
    ? "text-purple-500"
    : contentType.includes("pdf")
      ? "text-red-500"
      : contentType.includes("spreadsheet") || contentType.includes("csv")
        ? "text-green-500"
        : "text-text-tertiary";

  return <FileIcon className={clsx("h-3.5 w-3.5 shrink-0", color)} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
