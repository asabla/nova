import { MarkdownRenderer } from "../markdown/MarkdownRenderer";

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3 px-4 py-4">
      <div className="shrink-0 mt-0.5">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col max-w-[80%] items-start">
        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 bg-surface-secondary border border-border">
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <div className="flex gap-1 py-1">
              <span className="h-2 w-2 bg-text-tertiary rounded-full animate-bounce" />
              <span className="h-2 w-2 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="h-2 w-2 bg-text-tertiary rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          )}
          <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
        </div>
      </div>
    </div>
  );
}
