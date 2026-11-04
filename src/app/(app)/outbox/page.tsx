import { requireStaff } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";

export default async function OutboxPage() {
  await requireStaff("/outbox");
  return (
    <>
      <PageHeader title="Outbox" />
      <PageBody>
        <p className="text-muted">Coming in a later phase.</p>
      </PageBody>
    </>
  );
}
