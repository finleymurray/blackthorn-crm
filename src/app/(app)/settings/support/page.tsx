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
        <h2 className="text-[15px] font-medium">Support rules</h2>
        <p className="text-xs text-muted">Ticket categories, the root cause tags required to close a complaint, and how long each priority has before a ticket is overdue.</p>
      </div>
      <SupportRules categories={config.categories} rootCauses={config.rootCauses} sla={config.sla} />
    </section>
  );
}
