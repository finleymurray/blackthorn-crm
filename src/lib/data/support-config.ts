import type { Db } from "@/lib/db/client";
import type { SlaPolicies } from "@/lib/support/sla";

export interface TicketCategory {
  key: string;
  label: string;
  default_priority: "low" | "normal" | "high" | "urgent";
  sort_order: number;
  active: boolean;
}
export interface RootCauseTag {
  key: string;
  label: string;
  active: boolean;
}
export interface SavedReply {
  id: string;
  title: string;
  category: string | null;
  body: string;
  sort_order: number;
}
export interface StaffOption {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export interface SupportConfig {
  categories: TicketCategory[];
  rootCauses: RootCauseTag[];
  sla: SlaPolicies;
  savedReplies: SavedReply[];
  staff: StaffOption[];
}

export async function getSupportConfig(db: Db): Promise<SupportConfig> {
  const [categories, rootCauses, slaRows, savedReplies, staff] = await Promise.all([
    db<TicketCategory[]>`select key, label, default_priority::text as default_priority, sort_order, active from public.ticket_categories order by sort_order, label`,
    db<RootCauseTag[]>`select key, label, active from public.root_cause_tags order by label`,
    db<{ priority: keyof SlaPolicies; hours: number }[]>`select priority::text as priority, hours from public.sla_policies`,
    db<SavedReply[]>`select id, title, category, body, sort_order from public.saved_replies order by sort_order, title`,
    db<StaffOption[]>`select id, name, role::text as role, active from public.staff_users order by name`,
  ]);
  const sla: SlaPolicies = { urgent: 4, high: 8, normal: 24, low: 72 };
  for (const r of slaRows) sla[r.priority] = r.hours;
  return { categories, rootCauses, sla, savedReplies, staff };
}
