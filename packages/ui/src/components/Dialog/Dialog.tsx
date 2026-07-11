"use client";

import type { ReactNode } from "react";
import { Modal, ModalDescription, ModalTitle } from "../Modal/Modal";
import { Stack } from "../Stack/Stack";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Stack gap="md">
        <Stack gap="2xs">
          <ModalTitle asChild>
            <h2>{title}</h2>
          </ModalTitle>
          {description ? <ModalDescription>{description}</ModalDescription> : null}
        </Stack>
        {children}
        {footer ? <div className="flex justify-end gap-xs">{footer}</div> : null}
      </Stack>
    </Modal>
  );
}
