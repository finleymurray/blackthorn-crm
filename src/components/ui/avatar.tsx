import { cn, initials } from "@/lib/utils";

// Muted tints so a list of people reads as a list, not a colour chart.
const PALETTE = ["#2c3340", "#2e3a38", "#3a3429", "#38302e", "#2f3830", "#3b2e31", "#2d3440", "#35362b"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const colour = PALETTE[hash(name) % PALETTE.length]!;
  const dims = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-11 text-sm" : "size-8 text-[11px]";
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white/80 ring-1 ring-inset ring-white/[0.06]", dims, className)}
      style={{ background: colour }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
