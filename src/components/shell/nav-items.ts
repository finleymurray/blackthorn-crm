import {
  LayoutDashboard,
  Users,
  Filter,
  Megaphone,
  Workflow,
  LifeBuoy,
  Inbox,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { StaffRole } from "@/lib/auth/types";
import { ROLE_ACCESS } from "@/lib/auth/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/segments", label: "Segments", icon: Filter },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/outbox", label: "Outbox", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function navForRole(role: StaffRole): NavItem[] {
  return NAV_ITEMS.filter((item) => (ROLE_ACCESS[item.href] ?? []).includes(role));
}
