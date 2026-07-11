import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const gapClasses = {
  none: "gap-0",
  "3xs": "gap-3xs",
  "2xs": "gap-2xs",
  xs: "gap-xs",
  sm: "gap-sm",
  md: "gap-md",
  lg: "gap-lg",
  xl: "gap-xl",
} as const;

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: keyof typeof gapClasses;
  align?: "start" | "center" | "end" | "stretch";
}

const alignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = "md", align = "stretch", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col", gapClasses[gap], alignClasses[align], className)}
        {...props}
      />
    );
  },
);

Stack.displayName = "Stack";
