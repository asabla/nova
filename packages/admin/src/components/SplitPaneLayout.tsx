import { useState, useRef, useCallback, useEffect } from "react";
import { Settings2, MessageSquare } from "lucide-react";

interface SplitPaneLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey: string;
  defaultRatio?: number;
  minLeft?: number;
  minRight?: number;
  accentColor?: string;
}

function getStoredRatio(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v) {
      const n = parseFloat(v);
      if (n > 0.2 && n < 0.8) return n;
    }
  } catch {}
  return fallback;
}

export function SplitPaneLayout({
  left,
  right,
  storageKey,
  defaultRatio = 0.42,
  minLeft = 360,
  minRight = 320,
  accentColor,
}: SplitPaneLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => getStoredRatio(storageKey, defaultRatio));
  const isDragging = useRef(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">("left");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const w = rect.width;
      const clamped = Math.max(minLeft / w, Math.min(1 - minRight / w, x / w));
      setRatio(clamped);
    };

    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem(storageKey, String(ratio)); } catch {}
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [minLeft, minRight, ratio, storageKey]);

  if (isMobile) {
    return (
      <div className="relative h-full">
        {mobilePanel === "left" ? left : right}
        <button
          onClick={() => setMobilePanel((p) => (p === "left" ? "right" : "left"))}
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all"
          style={{
            background: accentColor ?? "var(--color-accent-blue)",
            color: "#fff",
            boxShadow: `0 4px 20px ${accentColor ?? "var(--color-accent-blue)"}40`,
          }}
        >
          {mobilePanel === "left" ? <MessageSquare className="h-5 w-5" /> : <Settings2 className="h-5 w-5" />}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Left pane */}
      <div style={{ flex: `0 0 ${ratio * 100}%` }} className="overflow-hidden">
        {left}
      </div>

      {/* Resize handle */}
      <div
        className="relative flex-shrink-0 group cursor-col-resize"
        style={{ width: 7 }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors group-hover:w-0.5"
          style={{ background: "var(--color-border-subtle)" }}
        />
        {/* Grip dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-60 transition-opacity">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1 w-1 rounded-full" style={{ background: "var(--color-text-muted)" }} />
          ))}
        </div>
      </div>

      {/* Right pane */}
      <div className="flex-1 overflow-hidden" style={{ background: "var(--color-surface)" }}>
        {right}
      </div>
    </div>
  );
}
