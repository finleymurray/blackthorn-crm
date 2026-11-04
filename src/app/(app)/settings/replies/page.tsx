import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getSupportConfig } from "@/lib/data/support-config";
import { SavedRepliesManager } from "@/components/settings/saved-replies-manager";

export const metadata: Metadata = { title: "Saved replies" };

export default async function SavedRepliesPage() {
  const staff = await requireRole("admin");
  const config = await withStaff(staff, getSupportConfig);
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[15px] font-medium">Saved replies</h2>
        <p className="text-xs text-muted">Templates the support team can drop into a reply. Merge fields such as {"{{first_name}}"} and {"{{booking_reference}}"} are filled in for the ticket.</p>
      </div>
      <SavedRepliesManager replies={config.savedReplies} categories={config.categories.map((c) => ({ key: c.key, label: c.label }))} />
    </section>
  );
}
