import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getSupportConfig } from "@/lib/data/support-config";
import { SupportRules } from "@/components/settings/support-rules";

export const metadata: Metadata = { title: "Support rules" };

export default async function SupportRulesPage() {
  const staff = await requireRole("admin");
  const config = await withStaff(staff, getSupportConfig);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Support rules</h2>
        <p className="text-[13px] text-muted">Ticket categories and how long each priority has before a ticket is overdue.</p>
      </div>
      <SupportRules categories={config.categories} sla={config.sla} />
    </section>
  );
}
