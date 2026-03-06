import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  WifiOff,
  ServerCrash,
  ArrowRightLeft,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "../ui/Button";

type ErrorCategory = "rate-limit" | "server" | "network" | "unknown";

interface ErrorMessageProps {
  /** The error message string or Error object */
  error: string | Error;
  /** HTTP status code, if available */
  statusCode?: number;
  /** Callback to retry the failed message */
  onRetry?: () => void;
  /** Callback to retry with a fallback model */
  onRetryWithFallback?: (fallbackModel: string) => void;
  /** Available fallback model identifier */
  fallbackModel?: string;
  /** Number of auto-retry attempts already made */
  retryCount?: number;
  /** Maximum auto-retry attempts before giving up */
  maxAutoRetries?: number;
  /** Estimated seconds until rate limit resets */
  retryAfterSeconds?: number;
}

function categorizeError(
  error: string | Error,
  statusCode?: number,
): ErrorCategory {
  const message =
    typeof error === "string" ? error : error.message;
  const msg = message.toLowerCase();

  if (statusCode === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate-limit";
  }
  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("failed to fetch") ||
    statusCode === 0
  ) {
    return "network";
  }
  if (statusCode && statusCode >= 500) {
    return "server";
  }
  return "unknown";
}

const categoryConfig: Record<
  ErrorCategory,
  {
    icon: typeof AlertTriangle;
    bgClass: string;
    borderClass: string;
    iconClass: string;
    titleKey: string;
  }
> = {
  "rate-limit": {
    icon: Clock,
    bgClass: "bg-warning/5",
    borderClass: "border-warning/30",
    iconClass: "text-warning",
    titleKey: "errors.rateLimitTitle",
  },
  server: {
    icon: ServerCrash,
    bgClass: "bg-danger/5",
    borderClass: "border-danger/30",
    iconClass: "text-danger",
    titleKey: "errors.serverTitle",
  },
  network: {
    icon: WifiOff,
    bgClass: "bg-danger/5",
    borderClass: "border-danger/30",
    iconClass: "text-danger",
    titleKey: "errors.networkTitle",
  },
  unknown: {
    icon: AlertTriangle,
    bgClass: "bg-danger/5",
    borderClass: "border-danger/30",
    iconClass: "text-danger",
    titleKey: "errors.unknownTitle",
  },
};

export function ErrorMessage({
  error,
  statusCode,
  onRetry,
  onRetryWithFallback,
  fallbackModel,
  retryCount = 0,
  maxAutoRetries = 3,
  retryAfterSeconds,
}: ErrorMessageProps) {
  const { t } = useTranslation();
  const [autoRetrying, setAutoRetrying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(
    retryAfterSeconds ?? null,
  );

  const category = categorizeError(error, statusCode);
  const config = categoryConfig[category];
  const Icon = config.icon;
  const errorMessage = typeof error === "string" ? error : error.message;

  const canAutoRetry = retryCount < maxAutoRetries && onRetry;
  const showFallback = !!fallbackModel && !!onRetryWithFallback;

  // Auto-retry logic for transient errors (network / server)
  const handleAutoRetry = useCallback(() => {
    if (!canAutoRetry) return;
    setAutoRetrying(true);
    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
    const timer = setTimeout(() => {
      setAutoRetrying(false);
      onRetry?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [canAutoRetry, retryCount, onRetry]);

  // Auto-retry on mount for network/server errors if retries remain
  useEffect(() => {
    if (
      (category === "network" || category === "server") &&
      canAutoRetry &&
      retryCount > 0
    ) {
      const cleanup = handleAutoRetry();
      return cleanup;
    }
  }, [category, canAutoRetry, retryCount, handleAutoRetry]);

  // Countdown timer for rate-limit
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <div
      className={clsx(
        "rounded-xl border px-4 py-3 mx-4 my-2",
        config.bgClass,
        config.borderClass,
      )}
      role="alert"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Icon className={clsx("h-5 w-5 shrink-0 mt-0.5", config.iconClass)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">
            {t(config.titleKey)}
          </p>
          <p className="text-xs text-text-secondary mt-0.5 break-words">
            {errorMessage}
          </p>

          {/* Rate-limit countdown */}
          {category === "rate-limit" && countdown !== null && countdown > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs text-warning font-medium">
                {t("errors.retryIn", { seconds: countdown })}
              </span>
            </div>
          )}

          {/* Auto-retry indicator */}
          {autoRetrying && (
            <div className="mt-2 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-text-tertiary animate-spin" />
              <span className="text-xs text-text-tertiary">
                {t("errors.autoRetrying", {
                  attempt: retryCount + 1,
                  max: maxAutoRetries,
                })}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {!autoRetrying && (
            <div className="flex items-center gap-2 mt-3">
              {onRetry && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRetry}
                  disabled={
                    category === "rate-limit" &&
                    countdown !== null &&
                    countdown > 0
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("errors.retry")}
                </Button>
              )}

              {showFallback && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetryWithFallback(fallbackModel)}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  {t("errors.retryWithFallback", { model: fallbackModel })}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
