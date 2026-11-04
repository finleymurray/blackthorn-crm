import { requireRole } from "@/lib/auth/session";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return (
    <>
      <PageHeader title="Settings" />
      <PageBody className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </PageBody>
    </>
  );
}
