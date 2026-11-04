import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small status tag. Square-cornered and quiet by default; a coloured dot
 * carries the state so colour is never the only signal.
 */
const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-px text-[11px] font-medium leading-[18px] whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-border bg-surface-raised text-muted-strong",
      accent: "border-accent/40 bg-accent-soft text-[#f2a7ab]",
      success: "border-success/30 bg-success-soft text-success",
      warning: "border-warning/30 bg-warning-soft text-warning",
      danger: "border-danger/30 bg-danger-soft text-danger",
      info: "border-info/30 bg-info-soft text-info",
      outline: "border-border-strong bg-transparent text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

const dotColour: Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, string> = {
  default: "bg-muted",
  accent: "bg-[#e37a80]",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  outline: "bg-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className={cn("size-1.5 shrink-0 rounded-full", dotColour[variant ?? "default"])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
