"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { iconButtonInteraction } from "../../lib/motion";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  ariaLabel: string;
  side?: "left" | "right";
  className?: string;
  /**
   * Scopes the panel to a specific theme's design tokens regardless of the
   * ambient page theme — e.g. a dark-glass mobile nav that stays dark even
   * when the site is in light mode, matching an "immersive" trigger's
   * identity. Omit to inherit the ambient theme (the pre-existing behavior).
   */
  dataTheme?: "dark" | "light";
}

export function Drawer({
  open,
  onOpenChange,
  children,
  ariaLabel,
  side = "right",
  className,
  dataTheme,
}: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard) motion-safe:starting:opacity-0" />
        <DialogPrimitive.Content
          data-theme={dataTheme}
          aria-label={ariaLabel}
          className={cn(
            "fixed inset-y-0 z-50 flex w-[min(20rem,100%)] flex-col gap-md border-surface-border bg-surface/95 p-lg shadow-lg backdrop-blur-md focus:outline-none",
            "motion-safe:transition-transform motion-safe:duration-(--duration-panel) motion-safe:ease-(--ease-standard)",
            side === "right" ? "right-0 border-l motion-safe:starting:translate-x-full" : "left-0 border-r motion-safe:starting:-translate-x-full",
            className,
          )}
        >
          <DialogPrimitive.Close
            className={cn(
              "ml-auto rounded-sm text-muted-foreground hover:text-foreground",
              iconButtonInteraction,
            )}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
