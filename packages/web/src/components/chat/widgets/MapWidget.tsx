export function MapWidget({ params }: { params?: Record<string, string> }) {
  const lat = parseFloat(params?.lat ?? "51.505");
  const lon = parseFloat(params?.lon ?? "-0.09");
  const zoom = parseInt(params?.zoom ?? "13", 10);
  const query = params?.query ?? "";

  // Calculate bounding box from lat/lon/zoom
  const offset = 360 / Math.pow(2, zoom + 1);
  const bbox = [lon - offset, lat - offset, lon + offset, lat + offset].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lon}&layers=mapnik`;

  return (
    <div className="relative">
      {query && (
        <div className="px-4 py-1.5 text-xs text-text-secondary border-b border-border">
          {query}
        </div>
      )}
      <iframe
        src={src}
        className="w-full border-0"
        style={{ height: 300 }}
        sandbox="allow-scripts allow-same-origin"
        title={query || "Map"}
      />
    </div>
  );
}
