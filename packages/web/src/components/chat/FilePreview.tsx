import { useState, useEffect } from "react";
import { X, FileText, Image, FileCode, File as FileIcon } from "lucide-react";

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

/** File extensions treated as code files for icon display. */
const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "kt",
  "c", "cpp", "h", "hpp", "cs", "swift", "sh", "bash", "zsh",
  "json", "yaml", "yml", "toml", "xml", "html", "css", "scss",
  "sql", "graphql", "proto", "lua", "zig", "hs", "ex", "exs",
]);

function isCodeFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return CODE_EXTENSIONS.has(ext);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Generate thumbnail for image files
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    setThumbnailUrl(url);

    return () => {
      URL.revokeObjectURL(url);
      setThumbnailUrl(null);
    };
  }, [file]);

  const renderIcon = () => {
    if (file.type.startsWith("image/") && thumbnailUrl) {
      return (
        <img
          src={thumbnailUrl}
          alt={file.name}
          className="h-10 w-10 rounded object-cover"
        />
      );
    }

    if (file.type === "application/pdf") {
      return (
        <div className="h-10 w-10 rounded bg-danger/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-danger" />
        </div>
      );
    }

    if (isCodeFile(file.name)) {
      return (
        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
          <FileCode className="h-5 w-5 text-primary" />
        </div>
      );
    }

    return (
      <div className="h-10 w-10 rounded bg-surface-tertiary flex items-center justify-center">
        {file.type.startsWith("image/") ? (
          <Image className="h-5 w-5 text-text-tertiary" />
        ) : (
          <FileIcon className="h-5 w-5 text-text-tertiary" />
        )}
      </div>
    );
  };

  return (
    <div className="relative group flex items-center gap-2 bg-surface-secondary border border-border rounded-lg px-3 py-2 min-w-[160px] max-w-[220px]">
      {renderIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-text">{file.name}</p>
        <p className="text-[10px] text-text-tertiary">{formatSize(file.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-surface border border-border rounded-full p-0.5 text-text-tertiary hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
