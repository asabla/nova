import { useState } from "react";
import { clsx } from "clsx";

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColor(name?: string): string {
  if (!name) return "bg-surface-tertiary";
  const colors = [
    "bg-blue-600", "bg-purple-600", "bg-pink-600", "bg-orange-600",
    "bg-teal-600", "bg-cyan-600", "bg-indigo-600", "bg-rose-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  };

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : "User avatar"}
        onError={() => setImgError(true)}
        className={clsx("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name ? `${name}'s avatar` : "User avatar"}
      className={clsx(
        "rounded-full flex items-center justify-center font-medium text-white",
        sizeClasses[size],
        getColor(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
