"use client";

import { animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

export type MotionNumberFormat = "integer" | "decimal" | "percent";

export interface MotionNumberProps {
  value: number;
  format?: MotionNumberFormat;
  /** Digits after the decimal point. Ignored for "integer". Defaults to 0, or 1 for "percent". */
  decimals?: number;
  /** Seconds the count-up/down takes. Fixed and deterministic — never derived from the size of the change. Defaults to 0.6. */
  duration?: number;
  className?: string;
  locale?: string;
}

function formatValue(value: number, format: MotionNumberFormat, decimals: number, locale: string): string {
  if (format === "percent") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  const fractionDigits = format === "decimal" ? decimals : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * TASK-051 — deterministic numeric tween, not a fake random count-up: it
 * always animates from the value it last held to the new `value` prop over
 * a fixed `duration`, using Framer's `animate()` to write formatted text
 * directly into a ref via `textContent` on every tick rather than React
 * state, so a fast-changing number never triggers a React re-render per
 * frame. `value` is rendered as real JSX children too, so server output and
 * the first client paint already show the correctly formatted number before
 * any animation logic runs — the tween only ever plays on top of that for a
 * later prop change.
 *
 * Accessibility: the outer `<span>` carries `role="group"` (a plain `<span>`
 * has no default ARIA role that permits naming from `aria-label` at all,
 * which axe-core's `aria-prohibited-attr` rule catches) plus `aria-label`
 * with the plain formatted value, the one thing a screen reader reads. The
 * animated inner span is `aria-hidden`, so no intermediate tween frame is
 * ever announced and the value isn't read twice. Under reduced motion the new value is
 * written immediately with no tween, using the same `usePrefersReducedMotion`
 * primitive as every other component here.
 */
export function MotionNumber({
  value,
  format = "integer",
  decimals = format === "percent" ? 1 : 0,
  duration = 0.6,
  className,
  locale = "en-US",
}: MotionNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const previousValueRef = useRef(value);
  const prefersReducedMotion = usePrefersReducedMotion();
  const formatted = formatValue(value, format, decimals, locale);

  useEffect(() => {
    const node = spanRef.current;
    if (!node) return undefined;

    if (prefersReducedMotion) {
      node.textContent = formatValue(value, format, decimals, locale);
      previousValueRef.current = value;
      return undefined;
    }

    const controls = animate(previousValueRef.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => {
        node.textContent = formatValue(latest, format, decimals, locale);
      },
    });
    previousValueRef.current = value;

    return () => controls.stop();
  }, [value, format, decimals, duration, locale, prefersReducedMotion]);

  return (
    <span className={cn("tabular-nums", className)} role="group" aria-label={formatted}>
      <span ref={spanRef} aria-hidden="true">
        {formatted}
      </span>
    </span>
  );
}
