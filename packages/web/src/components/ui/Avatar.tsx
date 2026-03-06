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
    "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-orange-500",
    "bg-teal-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const sizeClasses = {
    xs: "h-5 w-5 text-[8px]",
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-base",
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Avatar"}
        className={clsx("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
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
