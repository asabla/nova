import { useState, useEffect } from "react";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";

export function QRCodeWidget({ params }: { params?: Record<string, string> }) {
  const data = params?.data;
  const size = parseInt(params?.size ?? "200");

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;

    setLoading(true);
    setError(null);

    QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: { dark: "#ffffff", light: "#00000000" },
    })
      .then((url) => {
        setDataUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to generate QR code");
        setLoading(false);
      });
  }, [data, size]);

  if (!data) {
    return (
      <div className="px-4 py-6 text-center">
        <QrCode className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
        <div className="text-sm text-text-tertiary">No data provided</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-center">
        <QrCode className="h-8 w-8 text-text-tertiary mx-auto mb-2 animate-pulse" />
        <div className="text-xs text-text-tertiary">Generating QR code…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center">
        <QrCode className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 flex flex-col items-center">
      {dataUrl && (
        <img
          src={dataUrl}
          alt="QR Code"
          width={size}
          height={size}
          className="rounded"
        />
      )}
      <div className="text-xs text-text-tertiary mt-2 max-w-[260px] truncate text-center">
        {data}
      </div>
    </div>
  );
}
