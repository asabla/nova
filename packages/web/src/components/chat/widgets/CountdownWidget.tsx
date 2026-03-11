import { useState, useEffect } from "react";

export function CountdownWidget({ params }: { params?: Record<string, string> }) {
  const targetDate = params?.date ? new Date(params.date) : new Date(Date.now() + 86400000);
  const label = params?.label ?? "Countdown";

  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Completed!");
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      parts.push(`${hours}h`, `${minutes}m`, `${seconds}s`);
      setRemaining(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className="text-2xl font-mono font-light text-text">{remaining}</div>
    </div>
  );
}
