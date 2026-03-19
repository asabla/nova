import { useEffect, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Dialog({ open, onClose, title, children, className, size = "md" }: DialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      // Focus first interactive element inside the dialog
      const focusable = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      // Restore focus to the element that opened the dialog
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={title ? titleId : undefined}
      className={clsx(
        "m-auto rounded-xl bg-surface border border-border p-0 shadow-2xl backdrop:bg-overlay",
        sizeClasses[size],
        "w-full",
        className,
      )}
    >
      <div className="p-6">
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 id={titleId} className="text-lg font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              aria-label={t("common.close", "Close")}
              className="text-text-tertiary hover:text-text p-1 rounded-lg hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-primary"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
