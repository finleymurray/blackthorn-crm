"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Park details", blurb: "Name, logo, sender identity" },
  { href: "/settings/staff", label: "Staff and roles", blurb: "Who can sign in and what they see" },
  { href: "/settings/replies", label: "Saved replies", blurb: "Templates for the support inbox" },
  { href: "/settings/support", label: "Support rules", blurb: "Categories, root causes, SLA times" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="lg:sticky lg:top-16 lg:self-start">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map((i) => {
          const active = pathname === i.href;
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("block rounded-md px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring", active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}
              >
                <span className={cn("block text-[13px]", active ? "text-foreground" : "text-muted-strong")}>{i.label}</span>
                <span className="hidden text-[11px] text-muted lg:block">{i.blurb}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
