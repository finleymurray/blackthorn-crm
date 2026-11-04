"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThornMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { navForRole, type NavGroup } from "./nav-items";
import type { StaffRole } from "@/lib/auth/types";

export function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-4">
      {groups.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label ? <p className="mb-1 px-5 text-[11px] font-medium text-muted">{group.label}</p> : null}
          <ul>
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 py-[7px] pl-5 pr-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      active ? "bg-white/[0.04] font-medium text-foreground" : "text-muted-strong hover:bg-white/[0.03] hover:text-foreground",
                    )}
                  >
                    {active ? <span className="absolute inset-y-1 left-0 w-0.5 bg-accent" aria-hidden /> : null}
                    <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ role }: { role: StaffRole }) {
  const groups = navForRole(role);
  return (
    <aside className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-background">
      <div className="flex h-12 items-center gap-2 border-b border-border px-5">
        <ThornMark className="size-5 text-foreground" />
        <span className="font-display text-[17px] leading-none tracking-wide">Blackthorn</span>
        <span className="ml-auto rounded-[3px] border border-border px-1 text-[10px] text-muted">CRM</span>
      </div>
      <div className="flex flex-1 flex-col py-4">
        <SidebarNav groups={groups} />
      </div>
      <div className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted">
        Demo environment. Messages go to the outbox; payments are simulated.
      </div>
    </aside>
  );
}
