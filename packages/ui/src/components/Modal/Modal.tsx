"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { iconButtonInteraction } from "../../lib/motion";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Only needed when no <ModalTitle> is rendered inside — Radix otherwise
   * derives the accessible name from the title automatically. */
  ariaLabel?: string;
}

export function Modal({ open, onOpenChange, children, className, ariaLabel }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard) motion-safe:starting:opacity-0" />
        <DialogPrimitive.Content
          aria-label={ariaLabel}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-surface-border bg-surface p-lg shadow-lg focus:outline-none",
            "motion-safe:transition-[opacity,transform] motion-safe:duration-(--duration-base) motion-safe:ease-(--ease-standard)",
            "motion-safe:starting:opacity-0 motion-safe:starting:scale-95",
            className,
          )}
        >
          {children}
          <DialogPrimitive.Close
            className={cn(
              "absolute right-md top-md rounded-sm text-muted-foreground hover:text-foreground",
              iconButtonInteraction,
            )}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const ModalTitle = DialogPrimitive.Title;
export const ModalDescription = DialogPrimitive.Description;
