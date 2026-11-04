import { cn, initials } from "@/lib/utils";

const PALETTE = ["#5b5bd6", "#2f8f83", "#b4772a", "#8d4fa8", "#2f7fc1", "#a33f5c", "#4f8b3b", "#7d6a2f"];

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
      style={{ background: `linear-gradient(135deg, ${colour}, ${colour}cc)` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
