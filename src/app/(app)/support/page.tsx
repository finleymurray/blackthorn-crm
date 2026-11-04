import { requireStaff } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";

export default async function SupportPage() {
  await requireStaff("/support");
  return (
    <>
      <PageHeader title="Support" />
      <PageBody>
        <p className="text-muted">Coming in a later phase.</p>
      </PageBody>
    </>
  );
}
