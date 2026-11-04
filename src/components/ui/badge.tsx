import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Status tag: soft fill, a dot for state, never colour alone. */
const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-[4px] px-1.5 text-[11px] font-medium leading-[18px] whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-white/[0.06] text-muted-strong",
      accent: "bg-accent-soft text-accent-text",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
      info: "bg-info-soft text-info",
      outline: "shadow-[inset_0_0_0_1px_var(--border-strong)] text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

const dotColour: Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, string> = {
  default: "bg-muted",
  accent: "bg-accent-text",
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
