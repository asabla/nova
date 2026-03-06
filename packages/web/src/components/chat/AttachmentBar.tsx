import { FilePreview } from "./FilePreview";

interface AttachmentBarProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function AttachmentBar({ files, onRemove }: AttachmentBarProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto scrollbar-thin">
      {files.map((file, idx) => (
        <FilePreview
          key={`${file.name}-${file.size}-${idx}`}
          file={file}
          onRemove={() => onRemove(idx)}
        />
      ))}
    </div>
  );
}
