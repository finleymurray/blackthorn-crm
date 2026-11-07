import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * The header bar at the top of every page in the canvas: breadcrumb-style
 * title on the left, actions on the right. Content goes in <PageBody>.
 */
export function PageHeader({
  title,
  crumbs = [],
  meta,
  actions,
  className,
}: {
  title: React.ReactNode;
  crumbs?: Crumb[];
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface/95 px-5 backdrop-blur sm:px-8", className)}>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c) => (
          <span key={c.label} className="flex items-center gap-1 text-muted">
            {c.href ? (
              <Link href={c.href} className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                {c.label}
              </Link>
            ) : (
              c.label
            )}
            <ChevronRight className="size-3" aria-hidden />
          </span>
        ))}
        <h1 className="truncate font-medium text-foreground">{title}</h1>
        {meta ? <span className="ml-3 hidden truncate text-[13px] text-muted sm:inline">{meta}</span> : null}
      </nav>
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageBody({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("px-5 py-6 sm:px-8 sm:py-8", !wide && "mx-auto max-w-[1400px]", className)}>{children}</div>;
}
