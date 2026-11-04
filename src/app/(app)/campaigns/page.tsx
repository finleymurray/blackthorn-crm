import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function CampaignsPage() {
  await requireStaff("/campaigns");
  return <PageHeader title="Campaigns" description="Coming in a later phase." />;
}
