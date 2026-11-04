import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listAutomations } from "@/lib/data/automations";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { AutomationList } from "@/components/automations/automation-list";
import { canManageMarketing } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const staff = await requireStaff("/automations");
  const automations = await withStaff(staff, listAutomations);
  const active = automations.filter((a) => a.active).length;
  return (
    <>
      <PageHeader title="Automations" meta={`${active} of ${automations.length} switched on`} />
      <PageBody className="space-y-4">
        <p className="max-w-2xl text-xs text-muted">
          Automations send on their own when something happens: a booking, an upcoming visit, the morning after. Transactional messages (confirmation, reminder, survey) go to every booker. The win back automation is marketing, so it only goes to guests with consent.
        </p>
        <AutomationList automations={automations} editable={canManageMarketing(staff.role)} />
      </PageBody>
    </>
  );
}
