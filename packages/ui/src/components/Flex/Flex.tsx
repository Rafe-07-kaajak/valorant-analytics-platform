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

const alignClasses = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyClasses = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

export interface FlexProps extends HTMLAttributes<HTMLDivElement> {
  gap?: keyof typeof gapClasses;
  align?: keyof typeof alignClasses;
  justify?: keyof typeof justifyClasses;
  wrap?: boolean;
}

export const Flex = forwardRef<HTMLDivElement, FlexProps>(
  ({ className, gap = "md", align = "center", justify = "start", wrap = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          wrap && "flex-wrap",
          gapClasses[gap],
          alignClasses[align],
          justifyClasses[justify],
          className,
        )}
        {...props}
      />
    );
  },
);

Flex.displayName = "Flex";
