import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function GuestsPage() {
  await requireStaff("/guests");
  return <PageHeader title="Guests" description="Coming in a later phase." />;
}
