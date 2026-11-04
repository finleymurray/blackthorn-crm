import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function SupportPage() {
  await requireStaff("/support");
  return <PageHeader title="Support" description="Coming in a later phase." />;
}
