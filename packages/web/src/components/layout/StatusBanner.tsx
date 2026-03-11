import { useWSStore } from "../../stores/ws.store";
import { useTranslation } from "react-i18next";
import { WifiOff, RefreshCw } from "lucide-react";

export function StatusBanner() {
  const { t } = useTranslation();
  const status = useWSStore((s) => s.status);
  const hasConnected = useWSStore((s) => s.hasConnected);

  // Only show banner when a previously working connection is lost
  if (status === "connected" || !hasConnected) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center gap-2 text-sm text-warning"
    >
      {status === "reconnecting" || status === "connecting" ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("status.reconnecting")}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          {t("status.offline")}
        </>
      )}
    </div>
  );
}
