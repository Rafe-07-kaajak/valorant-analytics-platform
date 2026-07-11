import type { LucideIcon as LucideIconType } from "lucide-react";
import { cn } from "../../lib/cn";

export interface IconProps {
  icon: LucideIconType;
  size?: number;
  className?: string;
}

export function Icon({ icon: LucideIcon, size = 20, className }: IconProps) {
  return <LucideIcon size={size} className={cn("shrink-0", className)} aria-hidden="true" />;
}
