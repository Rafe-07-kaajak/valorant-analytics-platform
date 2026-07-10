import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type SectionProps = HTMLAttributes<HTMLElement>;

export const Section = forwardRef<HTMLElement, SectionProps>(({ className, ...props }, ref) => {
  return <section ref={ref} className={cn("py-2xl sm:py-3xl", className)} {...props} />;
});

Section.displayName = "Section";
