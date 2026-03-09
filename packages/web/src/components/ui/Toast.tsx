import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { create } from "zustand";
import { clsx } from "clsx";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

const MAX_TOASTS = 5;

interface ToastStore {
  toasts: ToastItem[];
  add: (toast: Omit<ToastItem, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }].slice(-MAX_TOASTS),
    })),
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

function toastFn(message: string, type: ToastItem["type"] = "info") {
  useToastStore.getState().add({ message, type });
}

toastFn.success = (message: string) => toastFn(message, "success");
toastFn.error = (message: string) => toastFn(message, "error");
toastFn.warning = (message: string) => toastFn(message, "warning");
toastFn.info = (message: string) => toastFn(message, "info");

export const toast = toastFn;

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: "bg-success/10 border-success/20 text-success",
  error: "bg-danger/10 border-danger/20 text-danger",
  warning: "bg-warning/10 border-warning/20 text-warning",
  info: "bg-primary/10 border-primary/20 text-primary",
};

function ToastEntry({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { t } = useTranslation();
  const Icon = icons[toast.type];
  const [paused, setPaused] = useState(false);
  const onDismissRef = useCallback(onDismiss, [toast.id]);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismissRef, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [onDismissRef, toast.duration, paused]);

  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-right",
        colors[toast.type],
      )}
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={onDismiss}
        aria-label={t("common.dismiss", "Dismiss")}
        className="shrink-0 opacity-60 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary rounded"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" aria-live="polite">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}
