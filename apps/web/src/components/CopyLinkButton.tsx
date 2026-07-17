"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui";

type CopyStatus = "idle" | "copied" | "error";

const STATUS_MESSAGE: Record<CopyStatus, string> = {
  idle: "",
  copied: "Link copied",
  error: "Couldn't copy the link",
};

const RESET_DELAY_MS = 2000;

/**
 * Copies the current page's canonical URL (already kept in sync by
 * `useCanonicalUrlState`) — never reconstructs it manually. Only touches the
 * clipboard in response to this button's own click, never automatically.
 */
export function CopyLinkButton() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      setStatus("error");
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), RESET_DELAY_MS);
  }

  return (
    <div className="flex items-center gap-2xs">
      <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
        Copy Link
      </Button>
      <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {STATUS_MESSAGE[status]}
      </span>
    </div>
  );
}
