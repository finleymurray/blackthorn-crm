import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getParkSettings } from "@/lib/data/settings";
import { ParkSettingsForm } from "@/components/settings/park-settings-form";

export const metadata: Metadata = { title: "Park details" };

export default async function ParkSettingsPage() {
  const staff = await requireRole("admin");
  const settings = await withStaff(staff, getParkSettings);
  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-medium">Park details</h2>
        <p className="text-[13px] text-muted">Used in email templates, the public contact form and the outbox preview.</p>
      </div>
      <ParkSettingsForm settings={settings} />
    </section>
  );
}
