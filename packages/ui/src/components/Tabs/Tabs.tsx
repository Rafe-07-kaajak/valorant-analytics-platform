"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/motion";

/**
 * TASK-033 reusable tab primitive. No page currently uses tabs — this exists
 * so a later feature (e.g. a chart-view switcher) can reach for a
 * unified-motion tab pattern instead of a one-off implementation.
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-md border-b border-surface-border", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative px-xs py-2xs text-sm font-medium text-muted-foreground",
        "transition-colors duration-(--duration-fast) ease-(--ease-standard)",
        "hover:text-foreground data-[state=active]:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-brand-500",
        "motion-safe:after:transition-transform motion-safe:after:duration-(--duration-base) motion-safe:after:ease-(--ease-standard)",
        "data-[state=active]:after:scale-x-100",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "outline-none",
        "motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard)",
        "motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0",
        className,
      )}
      {...props}
    />
  );
}
