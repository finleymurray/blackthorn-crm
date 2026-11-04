import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export default async function DashboardPage() {
  const staff = await requireStaff("/");
  return (
    <div className="space-y-6">
      <PageHeader title={`Good evening, ${staff.name.split(" ")[0]}`} description="Dashboard coming in the next phase." />
    </div>
  );
}
