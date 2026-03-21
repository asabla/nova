import { Play } from "lucide-react";

function extractVideoId(videoId?: string, url?: string): string | null {
  if (videoId) return videoId;
  if (!url) return null;

  const pattern =
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(pattern);
  return match?.[1] ?? null;
}

export function YouTubeWidget({ params }: { params?: Record<string, string> }) {
  const id = extractVideoId(params?.videoId, params?.url);
  const start = params?.start ?? "0";

  if (!id) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-warning">
        <Play className="h-4 w-4 shrink-0" />
        <span>Invalid or missing video ID</span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md">
      <div className="aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${id}?start=${start}`}
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
          title="YouTube video"
        />
      </div>
    </div>
  );
}
