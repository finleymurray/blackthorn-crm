import { requireStaff } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";

export default async function AutomationsPage() {
  await requireStaff("/automations");
  return (
    <>
      <PageHeader title="Automations" />
      <PageBody>
        <p className="text-muted">Coming in a later phase.</p>
      </PageBody>
    </>
  );
}
