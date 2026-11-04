import { requireStaff } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";

export default async function CampaignsPage() {
  await requireStaff("/campaigns");
  return (
    <>
      <PageHeader title="Campaigns" />
      <PageBody>
        <p className="text-muted">Coming in a later phase.</p>
      </PageBody>
    </>
  );
}
