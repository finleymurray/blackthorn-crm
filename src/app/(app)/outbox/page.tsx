import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function OutboxPage() {
  await requireStaff("/outbox");
  return <PageHeader title="Outbox" description="Coming in a later phase." />;
}
