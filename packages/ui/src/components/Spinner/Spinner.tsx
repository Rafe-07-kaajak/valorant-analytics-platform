import { cn } from "../../lib/cn";

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 16, className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block animate-spin rounded-full border-2 border-current/25 border-t-current", className)}
      style={{ width: size, height: size }}
    />
  );
}
