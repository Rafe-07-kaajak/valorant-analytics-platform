"use client";

import { useState } from "react";
import { cn } from "../../lib/cn";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
} as const;

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-badge-brand-bg font-semibold text-badge-brand-text",
        sizeClasses[size],
        className,
      )}
    >
      {showImage ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
