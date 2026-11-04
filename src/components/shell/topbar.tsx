"use client";

import * as React from "react";
import { Menu, LogOut, ChevronDown } from "lucide-react";
import { Dialog, DialogTrigger, SheetContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThornMark } from "@/components/brand/logo";
import { ROLE_LABELS, type StaffUser } from "@/lib/auth/types";
import { initials } from "@/lib/utils";
import { SidebarNav } from "./sidebar";
import { navForRole } from "./nav-items";
import { GlobalSearch } from "./global-search";

export function TopBar({ staff, signOutAction }: { staff: StaffUser; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const groups = navForRole(staff.role);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background px-3 sm:px-5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </DialogTrigger>
        <SheetContent side="left" aria-describedby={undefined} className="bg-background">
          <div className="flex h-12 items-center gap-2 border-b border-border px-5">
            <ThornMark className="size-5 text-foreground" />
            <DialogTitle className="font-display text-[17px] font-normal tracking-wide">Blackthorn</DialogTitle>
          </div>
          <div className="flex-1 py-4">
            <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 items-center">
        <GlobalSearch />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`Account menu for ${staff.name}`}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-surface-raised text-[11px] font-semibold text-foreground ring-1 ring-border" aria-hidden>
              {initials(staff.name)}
            </span>
            <span className="hidden sm:block">{staff.name}</span>
            <ChevronDown className="hidden size-3.5 text-muted sm:block" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate font-medium text-foreground">{staff.name}</p>
            <p className="truncate text-xs text-muted">{staff.email}</p>
            <p className="mt-1 text-xs text-muted">{ROLE_LABELS[staff.role]}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOutAction()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
