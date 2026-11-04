import { LayoutDashboard, Users, Filter, Megaphone, Workflow, LifeBuoy, Inbox, Settings, type LucideIcon } from "lucide-react";
import type { StaffRole } from "@/lib/auth/types";
import { ROLE_ACCESS } from "@/lib/auth/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/guests", label: "Guests", icon: Users },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/segments", label: "Segments", icon: Filter },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/automations", label: "Automations", icon: Workflow },
      { href: "/outbox", label: "Outbox", icon: Inbox },
    ],
  },
  {
    label: "Guest services",
    items: [{ href: "/support", label: "Support", icon: LifeBuoy }],
  },
  {
    label: "Admin",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function navForRole(role: StaffRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => (ROLE_ACCESS[item.href] ?? []).includes(role)) })).filter((g) => g.items.length > 0);
}
