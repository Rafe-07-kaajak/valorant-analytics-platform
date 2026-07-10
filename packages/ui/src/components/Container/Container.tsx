import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type ContainerProps = HTMLAttributes<HTMLDivElement>;

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("mx-auto w-full max-w-(--breakpoint-xl) px-sm sm:px-lg", className)}
        {...props}
      />
    );
  },
);

Container.displayName = "Container";
