import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/motion";

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Native `<input type="range">` — real keyboard (arrow keys, Home/End,
 * Page Up/Down), touch, and screen-reader support come for free, so no
 * custom widget was built. `accent-color` (via Tailwind's `accent-*`
 * utility, e.g. `accent-team-a`) themes the thumb/track without any
 * `::-webkit-slider-thumb`/`::-moz-range-thumb` overrides.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="range"
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-border accent-brand-500",
        "transition-opacity duration-(--duration-fast) ease-(--ease-standard)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        className,
      )}
      {...props}
    />
  );
});

Slider.displayName = "Slider";
