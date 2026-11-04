import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  await requireStaff("/settings");
  return <PageHeader title="Settings" description="Coming in a later phase." />;
}
