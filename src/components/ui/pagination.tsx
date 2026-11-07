import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  per,
  total,
  makeHref,
  className,
}: {
  page: number;
  per: number;
  total: number;
  makeHref: (page: number) => string;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / per));
  const from = total === 0 ? 0 : (page - 1) * per + 1;
  const to = Math.min(total, page * per);
  const linkClass = "inline-flex h-8 items-center gap-1 rounded-md bg-white/[0.06] px-3 text-[13px] hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-ring aria-disabled:pointer-events-none aria-disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <p className="text-[13px] text-muted">
        Showing <span className="text-foreground">{formatNumber(from)}–{formatNumber(to)}</span> of <span className="text-foreground">{formatNumber(total)}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link href={makeHref(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={linkClass}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
        <span className="text-[13px] text-muted">
          Page {formatNumber(page)} of {formatNumber(pages)}
        </span>
        <Link href={makeHref(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} className={linkClass}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
