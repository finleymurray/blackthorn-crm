"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThornMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { navForRole, type NavItem } from "./nav-items";
import type { StaffRole } from "@/lib/auth/types";

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active ? "bg-accent-soft text-foreground" : "text-muted-strong hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-[#e37a80]" : "text-muted group-hover:text-foreground")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ role }: { role: StaffRole }) {
  const items = navForRole(role);
  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface/60">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <ThornMark className="size-7 text-foreground" />
        <span className="font-display text-xl tracking-wide">Blackthorn</span>
      </div>
      <div className="flex flex-1 flex-col py-3">
        <SidebarNav items={items} />
      </div>
      <div className="border-t border-border px-5 py-3 text-xs text-muted">
        <p>Demo environment</p>
        <p className="mt-0.5">No real messages or payments</p>
      </div>
    </aside>
  );
}
