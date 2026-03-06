import { useState, useEffect } from "react";
import { ExternalLink, Globe, Play } from "lucide-react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Skeleton } from "../ui/Skeleton";

interface URLPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
  youtubeVideoId: string | null;
}

interface URLPreviewCardProps {
  url: string;
  className?: string;
}

function URLPreviewSkeleton() {
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-border bg-surface-secondary animate-pulse">
      <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

function YouTubeEmbed({ videoId, title }: { videoId: string; title: string | null }) {
  const [showEmbed, setShowEmbed] = useState(false);

  if (showEmbed) {
    return (
      <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title ?? "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowEmbed(true)}
      className="relative w-full rounded-xl overflow-hidden border border-border bg-black aspect-video group cursor-pointer"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt={title ?? "YouTube video thumbnail"}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fall back to lower quality thumbnail
          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
        </div>
      </div>
      {title && (
        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-sm text-white font-medium truncate">{title}</p>
        </div>
      )}
    </button>
  );
}

export function URLPreviewCard({ url, className }: URLPreviewCardProps) {
  const { data, isLoading, error } = useQuery<URLPreviewData>({
    queryKey: ["url-preview", url],
    queryFn: () => api.post<URLPreviewData>("/api/url/preview", { url }),
    staleTime: 1000 * 60 * 60, // cache for 1 hour
    retry: 1,
  });

  if (isLoading) {
    return <URLPreviewSkeleton />;
  }

  if (error || !data) {
    return null; // Silently fail -- URL is still shown as text in the message
  }

  // YouTube special handling
  if (data.youtubeVideoId) {
    return (
      <div className={clsx("my-2 max-w-md", className)}>
        <YouTubeEmbed videoId={data.youtubeVideoId} title={data.title} />
        {data.title && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-1.5 px-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{data.siteName ?? new URL(url).hostname}</span>
            <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
          </a>
        )}
      </div>
    );
  }

  // Standard URL preview card
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "flex gap-3 p-3 my-2 rounded-xl border border-border bg-surface-secondary",
        "hover:bg-surface-tertiary/50 transition-colors cursor-pointer no-underline",
        "max-w-md",
        className,
      )}
    >
      {/* Thumbnail */}
      {data.image && (
        <div className="h-16 w-16 rounded-lg overflow-hidden shrink-0 bg-surface-tertiary">
          <img
            src={data.image}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Text content */}
      <div className="flex-1 min-w-0">
        {data.title && (
          <p className="text-sm font-medium text-text line-clamp-1">{data.title}</p>
        )}
        {data.description && (
          <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
            {data.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <Globe className="h-3 w-3 text-text-tertiary shrink-0" />
          <span className="text-[10px] text-text-tertiary truncate">
            {data.siteName ?? new URL(url).hostname}
          </span>
          <ExternalLink className="h-3 w-3 text-text-tertiary shrink-0 ml-auto" />
        </div>
      </div>
    </a>
  );
}
