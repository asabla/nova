import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { CheckCircle2, XCircle, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let globalToast: (message: string, type?: ToastType) => void = () => {};

export function useToast() {
  return useContext(ToastContext);
}

/** Call from anywhere — no hook needed */
export function toast(message: string, type: ToastType = "success") {
  globalToast(message, type);
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: AlertCircle,
};

const colors = {
  success: { bg: "var(--color-accent-green-dim)", color: "var(--color-accent-green)" },
  error: { bg: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" },
  info: { bg: "var(--color-accent-blue-dim)", color: "var(--color-accent-blue)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    globalToast = addToast;
    return () => { globalToast = () => {}; };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          const c = colors[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg animate-[slideIn_0.2s_ease-out]"
              style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)", minWidth: 280 }}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: c.color }} />
              <span className="text-sm flex-1" style={{ color: "var(--color-text-primary)" }}>{t.message}</span>
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="shrink-0 p-0.5" style={{ color: "var(--color-text-muted)" }}>
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
