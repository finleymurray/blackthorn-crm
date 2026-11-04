"use client";

import * as React from "react";
import { Menu, LogOut, UserCircle2 } from "lucide-react";
import { Dialog, DialogTrigger, SheetContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThornMark } from "@/components/brand/logo";
import { ROLE_LABELS, type StaffUser } from "@/lib/auth/types";
import { initials } from "@/lib/utils";
import { SidebarNav } from "./sidebar";
import { navForRole } from "./nav-items";
import { GlobalSearch } from "./global-search";

export function TopBar({ staff, signOutAction }: { staff: StaffUser; signOutAction: () => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const items = navForRole(staff.role);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </DialogTrigger>
        <SheetContent side="left" aria-describedby={undefined}>
          <div className="flex h-14 items-center gap-2.5 px-5">
            <ThornMark className="size-7 text-foreground" />
            <DialogTitle className="font-display text-xl font-normal tracking-wide">Blackthorn</DialogTitle>
          </div>
          <div className="flex-1 py-3">
            <SidebarNav items={items} onNavigate={() => setOpen(false)} />
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
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-1 py-1 pr-3 text-sm hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`Account menu for ${staff.name}`}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white" aria-hidden>
              {initials(staff.name)}
            </span>
            <span className="hidden sm:block">
              <span className="block max-w-[10rem] truncate leading-tight">{staff.name}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="truncate font-medium text-foreground">{staff.name}</p>
            <p className="truncate text-xs text-muted">{staff.email}</p>
            <p className="mt-1 text-xs text-muted">{ROLE_LABELS[staff.role]}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserCircle2 /> Role: {ROLE_LABELS[staff.role]}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOutAction()} destructive>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
