import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

export function TimerWidget({ params }: { params?: Record<string, string> }) {
  const autoStart = params?.autoStart === "true";
  const label = params?.label ?? "Timer";

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const toggle = useCallback(() => setRunning((r) => !r), []);
  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
  }, []);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const display = [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className="text-2xl font-mono font-light text-text">{display}</div>
      <div className="flex items-center justify-center gap-2 mt-2">
        <button
          onClick={toggle}
          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
        >
          {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
          aria-label="Reset timer"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>
    </div>
  );
}
