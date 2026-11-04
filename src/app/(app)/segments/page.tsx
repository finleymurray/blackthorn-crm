import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function SegmentsPage() {
  await requireStaff("/segments");
  return <PageHeader title="Segments" description="Coming in a later phase." />;
}
