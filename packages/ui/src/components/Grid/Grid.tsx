import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const gapClasses = {
  none: "gap-0",
  "2xs": "gap-2xs",
  xs: "gap-xs",
  sm: "gap-sm",
  md: "gap-md",
  lg: "gap-lg",
  xl: "gap-xl",
} as const;

const colClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: keyof typeof colClasses;
  gap?: keyof typeof gapClasses;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ className, columns = 2, gap = "md", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("grid", colClasses[columns], gapClasses[gap], className)}
        {...props}
      />
    );
  },
);

Grid.displayName = "Grid";
