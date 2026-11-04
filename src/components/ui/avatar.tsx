import { cn, initials } from "@/lib/utils";

const PALETTE = ["#3b6ea5", "#2f8f83", "#a7762a", "#7a4f3a", "#4f8b3b", "#9a4a4a", "#4b6b8a", "#6b7a2f"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const colour = PALETTE[hash(name) % PALETTE.length]!;
  const dims = size === "sm" ? "size-5 text-[9px]" : size === "lg" ? "size-10 text-sm" : "size-6 text-[10px]";
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", dims, className)}
      style={{ background: colour }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
