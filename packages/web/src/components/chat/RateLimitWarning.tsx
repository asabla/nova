import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock, X } from "lucide-react";
import { clsx } from "clsx";

interface RateLimitWarningProps {
  /** Current usage count in the rate limit window */
  currentUsage: number;
  /** Maximum allowed in the rate limit window */
  limit: number;
  /** Seconds until the rate limit window resets (null = not rate-limited yet) */
  resetInSeconds?: number | null;
  /** Threshold percentage (0-1) at which to show the warning (default: 0.8 = 80%) */
  warningThreshold?: number;
  /** Whether the user is currently rate-limited (at or over limit) */
  isLimited?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

export function RateLimitWarning({
  currentUsage,
  limit,
  resetInSeconds = null,
  warningThreshold = 0.8,
  isLimited = false,
  onDismiss,
}: RateLimitWarningProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState(resetInSeconds);

  const usageRatio = limit > 0 ? currentUsage / limit : 0;
  const usagePercent = Math.min(usageRatio * 100, 100);
  const isApproaching = usageRatio >= warningThreshold && !isLimited;
  const remaining = Math.max(limit - currentUsage, 0);

  // Reset dismissed state if user becomes rate-limited
  useEffect(() => {
    if (isLimited) setDismissed(false);
  }, [isLimited]);

  // Sync countdown with prop changes
  useEffect(() => {
    setCountdown(resetInSeconds);
  }, [resetInSeconds]);

  // Countdown timer
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

  // Don't render if below threshold and not limited, or if dismissed
  if ((!isApproaching && !isLimited) || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const formatTime = (seconds: number): string => {
    if (seconds >= 60) {
      const mins = Math.ceil(seconds / 60);
      return t("rateLimit.minutes", { count: mins });
    }
    return t("rateLimit.seconds", { count: seconds });
  };

  return (
    <div
      className={clsx(
        "mx-4 my-2 rounded-xl border px-4 py-3 animate-in slide-in-from-top duration-200",
        isLimited
          ? "bg-danger/5 border-danger/30"
          : "bg-warning/5 border-warning/30",
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {isLimited ? (
          <Clock className="h-5 w-5 shrink-0 mt-0.5 text-danger" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-warning" />
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center justify-between">
            <p
              className={clsx(
                "text-sm font-medium",
                isLimited ? "text-danger" : "text-warning",
              )}
            >
              {isLimited
                ? t("rateLimit.limitedTitle")
                : t("rateLimit.approachingTitle")}
            </p>
            {!isLimited && onDismiss && (
              <button
                onClick={handleDismiss}
                className="text-text-tertiary hover:text-text-secondary p-0.5 rounded"
                aria-label={t("common.dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary mt-0.5">
            {isLimited
              ? t("rateLimit.limitedDesc")
              : t("rateLimit.approachingDesc", { remaining })}
          </p>

          {/* Progress bar */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
              <span>
                {currentUsage} / {limit} {t("rateLimit.requests")}
              </span>
              <span>{Math.round(usagePercent)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  isLimited
                    ? "bg-danger"
                    : usageRatio >= 0.9
                      ? "bg-warning"
                      : "bg-primary",
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          {/* Wait time */}
          {isLimited && countdown !== null && countdown > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-text-tertiary" />
              <span className="text-xs text-text-secondary">
                {t("rateLimit.resetIn", { time: formatTime(countdown) })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
