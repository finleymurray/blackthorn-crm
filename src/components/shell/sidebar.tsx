"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, Search } from "lucide-react";
import { ThornMark } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type StaffUser } from "@/lib/auth/types";
import { navForRole, type NavGroup } from "./nav-items";
import { CommandPalette } from "./command-palette";

export function SidebarNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-7 px-3">
      {groups.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label ? <p className="mb-1.5 px-2.5 text-xs font-medium text-muted">{group.label}</p> : null}
          <ul className="space-y-0.5">
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
                      "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      active ? "bg-white/[0.06] text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" : "text-white/60 hover:bg-white/[0.04] hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted")} strokeWidth={1.75} aria-hidden />
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

export function SidebarFrame({ staff, signOutAction, onNavigate }: { staff: StaffUser; signOutAction: () => Promise<void>; onNavigate?: () => void }) {
  const groups = navForRole(staff.role);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <ThornMark className="size-5 text-foreground" />
        <span className="font-display text-[17px] leading-none tracking-wide">Blackthorn</span>
      </div>

      <div className="px-3 pb-5">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 w-full items-center gap-2.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-sm text-white/50 hover:border-white/[0.16] hover:text-white/70 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-[3px] bg-white/[0.06] px-1 text-[11px] font-medium text-muted">⌘K</kbd>
        </button>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <SidebarNav groups={groups} onNavigate={onNavigate} />

      <div className="mt-auto p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-12 w-full items-center gap-2.5 rounded-md px-2.5 text-left hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Account menu for ${staff.name}`}
            >
              <Avatar name={staff.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{staff.name}</span>
                <span className="block truncate text-xs text-muted">{ROLE_LABELS[staff.role]}</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-60">
            <DropdownMenuLabel>
              <p className="truncate font-medium text-foreground">{staff.name}</p>
              <p className="truncate text-[13px] text-muted">{staff.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOutAction()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="px-2 pb-1 pt-2 text-xs leading-snug text-muted">Demo: messages go to the outbox, payments are simulated.</p>
      </div>
    </div>
  );
}
