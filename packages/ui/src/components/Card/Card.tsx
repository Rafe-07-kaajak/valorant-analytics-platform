import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-surface-border bg-surface p-md shadow-sm",
        className,
      )}
      {...props}
    />
  );
});

Card.displayName = "Card";
