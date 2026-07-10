import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const variantClasses = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "bg-surface text-foreground border border-surface-border hover:bg-surface-border",
  ghost: "text-foreground hover:bg-surface",
} as const;

const sizeClasses = {
  sm: "h-8 px-3 text-sm rounded-sm",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-12 px-6 text-base rounded-md",
} as const;

export interface ButtonVariantOptions {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: ButtonVariantOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-(--duration-fast) ease-(--ease-standard) disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
    );
  },
);

Button.displayName = "Button";
