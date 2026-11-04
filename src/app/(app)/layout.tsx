import { requireStaff } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { AppFrame } from "@/components/shell/app-frame";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <AppFrame staff={staff} signOutAction={signOut}>
        {children}
      </AppFrame>
    </>
  );
}
