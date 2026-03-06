import { X, FileText, Image, File as FileIcon } from "lucide-react";

interface FileUploadPreviewProps {
  files: { name: string; type: string; size: number; progress?: number }[];
  onRemove: (index: number) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <Image className="h-4 w-4 text-primary" />;
  if (type.includes("text") || type.includes("pdf")) return <FileText className="h-4 w-4 text-warning" />;
  return <FileIcon className="h-4 w-4 text-text-tertiary" />;
}

export function FileUploadPreview({ files, onRemove }: FileUploadPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto">
      {files.map((file, idx) => (
        <div
          key={idx}
          className="relative flex items-center gap-2 bg-surface-secondary border border-border rounded-lg px-3 py-2 min-w-[160px] max-w-[220px]"
        >
          <FileTypeIcon type={file.type} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-text">{file.name}</p>
            <p className="text-[10px] text-text-tertiary">{formatSize(file.size)}</p>
          </div>
          <button
            onClick={() => onRemove(idx)}
            className="absolute -top-1.5 -right-1.5 bg-surface border border-border rounded-full p-0.5 text-text-tertiary hover:text-danger transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
          {file.progress !== undefined && file.progress < 100 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border rounded-b-lg overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${file.progress}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
