import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function AutomationsPage() {
  await requireStaff("/automations");
  return <PageHeader title="Automations" description="Coming in a later phase." />;
}
