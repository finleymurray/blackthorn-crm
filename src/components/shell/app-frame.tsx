"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogTrigger, SheetContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThornMark } from "@/components/brand/logo";
import type { StaffUser } from "@/lib/auth/types";
import { SidebarFrame } from "./sidebar";

/**
 * App chrome: a fixed sidebar and an inset content canvas. On small screens
 * the sidebar lives in a sheet behind a menu button.
 */
export function AppFrame({ staff, signOutAction, children }: { staff: StaffUser; signOutAction: () => Promise<void>; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-[248px] shrink-0 lg:block">
        <SidebarFrame staff={staff} signOutAction={signOutAction} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col p-3 pl-0 max-lg:pl-3">
        <div className="flex h-10 items-center gap-2 lg:hidden">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
                <Menu />
              </Button>
            </DialogTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="bg-background">
              <DialogTitle className="sr-only">Navigation</DialogTitle>
              <SidebarFrame staff={staff} signOutAction={signOutAction} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Dialog>
          <ThornMark className="size-5 text-foreground" />
          <span className="font-display text-[17px] leading-none tracking-wide">Blackthorn</span>
        </div>
        <div className="app-canvas flex min-h-0 flex-1 flex-col overflow-hidden">
          <main id="main" className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
