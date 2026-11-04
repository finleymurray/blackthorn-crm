import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getSupportConfig } from "@/lib/data/support-config";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { NewTicketForm } from "@/components/support/new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ guest?: string }> }) {
  const staff = await requireStaff("/support");
  const { guest } = await searchParams;
  const data = await withStaff(staff, async (db) => {
    const config = await getSupportConfig(db);
    const prefill =
      guest && /^[0-9a-f-]{36}$/i.test(guest)
        ? (
            await db<{ name: string; email: string; reference: string | null }[]>`
              select g.first_name || ' ' || g.last_name as name, g.email,
                (select b.reference from crm.bookings b where b.guest_id = g.id and b.status <> 'refunded' order by b.booked_at desc limit 1) as reference
              from crm.guests g where g.id = ${guest}`
          )[0] ?? null
        : null;
    return { categories: config.categories.filter((c) => c.active).map((c) => ({ key: c.key, label: c.label })), prefill };
  });
  return (
    <>
      <PageHeader crumbs={[{ label: "Support", href: "/support" }]} title="New ticket" />
      <PageBody>
        <div className="max-w-2xl">
          <p className="mb-4 text-xs text-muted">Raise a ticket on a guest&apos;s behalf, for example after a phone call or at the front desk. It is matched to the guest record by email.</p>
          <NewTicketForm categories={data.categories} prefill={data.prefill} />
        </div>
      </PageBody>
    </>
  );
}
