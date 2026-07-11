"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  ariaLabel: string;
  side?: "left" | "right";
  className?: string;
}

export function Drawer({ open, onOpenChange, children, ariaLabel, side = "right", className }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-label={ariaLabel}
          className={cn(
            "fixed inset-y-0 z-50 flex w-[min(20rem,100%)] flex-col gap-md border-surface-border bg-surface p-lg shadow-lg focus:outline-none",
            side === "right" ? "right-0 border-l" : "left-0 border-r",
            className,
          )}
        >
          <DialogPrimitive.Close
            className="ml-auto rounded-sm text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
