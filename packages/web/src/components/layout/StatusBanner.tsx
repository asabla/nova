import { useWSStore } from "../../stores/ws.store";
import { useTranslation } from "react-i18next";
import { WifiOff, RefreshCw } from "lucide-react";

export function StatusBanner() {
  const { t } = useTranslation();
  const status = useWSStore((s) => s.status);

  if (status === "connected" || status === "disconnected") return null;

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center gap-2 text-sm text-warning">
      {status === "reconnecting" ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          {t("status.reconnecting")}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          {t("status.offline")}
        </>
      )}
    </div>
  );
}
