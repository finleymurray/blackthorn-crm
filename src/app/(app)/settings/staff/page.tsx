import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listStaff } from "@/lib/data/admin";
import { StaffManager } from "@/components/settings/staff-manager";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff and roles" };

export default async function StaffSettingsPage() {
  const staff = await requireRole("admin");
  const rows = await withStaff(staff, listStaff);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Staff and roles</h2>
        <p className="text-[13px] text-muted">
          Roles control what each person can see and do, enforced by database row level security, not just the menu. Admin: everything. Marketing: guests, segments, campaigns, automations, outbox. Support: guests and the inbox, including refunds. Front desk: guest lookup, raising tickets and moving bookings.
        </p>
      </div>
      <StaffManager rows={rows} currentId={staff.id} authConfigured={supabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} />
    </section>
  );
}
