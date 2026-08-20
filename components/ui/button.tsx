"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline"
  | "soft";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-sm",
  secondary:
    "bg-surface-2 text-foreground hover:bg-border/70 border border-border",
  outline:
    "border border-input bg-transparent text-foreground hover:bg-surface-2",
  ghost: "text-muted hover:text-foreground hover:bg-surface-2",
  soft: "bg-primary-soft text-primary hover:bg-primary-soft/70",
  danger: "bg-danger text-white hover:bg-danger/90 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  icon: "size-10 p-0",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", loading, children, disabled, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center rounded-xl font-medium transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);
