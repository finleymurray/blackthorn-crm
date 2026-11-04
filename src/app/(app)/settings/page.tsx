import { requireStaff } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  await requireStaff("/settings");
  return (
    <>
      <PageHeader title="Settings" />
      <PageBody>
        <p className="text-muted">Coming in a later phase.</p>
      </PageBody>
    </>
  );
}
