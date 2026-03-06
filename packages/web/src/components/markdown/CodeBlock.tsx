import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-surface-tertiary px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="text-text-tertiary hover:text-text-secondary p-1 rounded transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 bg-surface-secondary">
        <code className="text-xs font-mono leading-relaxed text-text">{code}</code>
      </pre>
    </div>
  );
}
