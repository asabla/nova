import {
  type ReactNode,
  type HTMLAttributes,
  type KeyboardEvent,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
} from "react";
import { clsx } from "clsx";

/* -------------------------------------------------------------------------- */
/*  VisuallyHidden                                                            */
/*  Renders content only visible to screen readers.                           */
/* -------------------------------------------------------------------------- */

interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  /** If true, content becomes visible when focused (useful for skip links) */
  focusable?: boolean;
}

export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ children, focusable = false, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          !focusable && [
            "absolute",
            "w-px",
            "h-px",
            "p-0",
            "m-[-1px]",
            "overflow-hidden",
            "[clip:rect(0,0,0,0)]",
            "whitespace-nowrap",
            "border-0",
          ],
          focusable && [
            "absolute",
            "w-px",
            "h-px",
            "p-0",
            "m-[-1px]",
            "overflow-hidden",
            "[clip:rect(0,0,0,0)]",
            "whitespace-nowrap",
            "border-0",
            "focus:static",
            "focus:w-auto",
            "focus:h-auto",
            "focus:p-2",
            "focus:m-0",
            "focus:overflow-visible",
            "focus:[clip:auto]",
            "focus:whitespace-normal",
          ],
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);

VisuallyHidden.displayName = "VisuallyHidden";

/* -------------------------------------------------------------------------- */
/*  SkipLink                                                                  */
/*  Keyboard-accessible skip navigation link that appears on focus.           */
/* -------------------------------------------------------------------------- */

interface SkipLinkProps {
  /** The id of the element to skip to (without #) */
  targetId: string;
  children?: ReactNode;
}

export function SkipLink({ targetId, children = "Skip to main content" }: SkipLinkProps) {
  const handleClick = useCallback(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus();
      // Remove tabindex after blur so it doesn't interfere with normal tab order
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    }
  }, [targetId]);

  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
      className={clsx(
        "fixed top-0 left-0 z-toast",
        "bg-primary text-primary-foreground",
        "px-4 py-2 text-sm font-medium",
        "rounded-br-lg shadow-lg",
        "transform -translate-y-full transition-transform",
        "focus:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/*  FocusTrap                                                                 */
/*  Traps keyboard focus within a container (for modals/dialogs).             */
/* -------------------------------------------------------------------------- */

interface FocusTrapProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Whether the focus trap is active */
  active?: boolean;
  /** Called when the user presses Escape */
  onEscape?: () => void;
  /** Whether to restore focus to the previously focused element on deactivation */
  restoreFocus?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

export function FocusTrap({
  children,
  active = true,
  onEscape,
  restoreFocus = true,
  ...props
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element and focus the first focusable child
  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Defer focusing so the container is fully rendered
    const timer = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        // If no focusable children, focus the container itself
        containerRef.current.setAttribute("tabindex", "-1");
        containerRef.current.focus();
      }
    });

    return () => {
      cancelAnimationFrame(timer);
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, restoreFocus]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!active || !containerRef.current) return;

      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [active, onEscape],
  );

  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} {...props}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Announce                                                                  */
/*  ARIA live region for dynamic announcements to screen readers.             */
/* -------------------------------------------------------------------------- */

interface AnnounceProps {
  /** The message to announce */
  message: string;
  /** Politeness level: "polite" waits for idle, "assertive" interrupts */
  politeness?: "polite" | "assertive";
  /** If true, only announce additions (useful for logs/chat) */
  additionsOnly?: boolean;
}

export function Announce({
  message,
  politeness = "polite",
  additionsOnly = false,
}: AnnounceProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Force re-announcement by clearing and re-setting the text content.
  // Screen readers only announce when the content changes.
  useEffect(() => {
    if (!ref.current || !message) return;

    const el = ref.current;
    el.textContent = "";

    // Small delay ensures the DOM mutation is detected as a change
    const timer = requestAnimationFrame(() => {
      el.textContent = message;
    });

    return () => cancelAnimationFrame(timer);
  }, [message]);

  return (
    <div
      ref={ref}
      role="status"
      aria-live={politeness}
      aria-atomic={!additionsOnly}
      aria-relevant={additionsOnly ? "additions" : "additions text"}
      className="absolute w-px h-px p-0 m-[-1px] overflow-hidden [clip:rect(0,0,0,0)] whitespace-nowrap border-0"
    />
  );
}
