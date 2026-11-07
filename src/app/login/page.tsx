import type { Metadata } from "next";
import { ThornMark } from "@/components/brand/logo";
import { LoginForm, type DemoLogin } from "./login-form";
import { adminSql } from "@/lib/db/client";
import { ROLE_LABELS, type StaffRole } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ROLE_BLURB: Record<StaffRole, string> = {
  admin: "Everything, including settings and staff",
  marketing: "Guests, segments, campaigns, automations",
  support: "Guests and the support inbox",
  front_desk: "Guest lookup and raising tickets",
};

async function loadDemoLogins(): Promise<DemoLogin[]> {
  try {
    const rows = await adminSql<{ name: string; email: string; role: StaffRole }[]>`
      select name, email, role from crm.staff_users where active
      order by array_position(array['admin','marketing','support','front_desk']::staff_role[], role)`;
    return rows.map((r) => ({ name: r.name, email: r.email, roleLabel: ROLE_LABELS[r.role], description: ROLE_BLURB[r.role] }));
  } catch {
    return [];
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const demoLogins = await loadDemoLogins();
  const password = process.env.DEMO_PASSWORD ?? "Blackthorn2026!";

  return (
    <main className="vignette flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <ThornMark className="size-9 text-foreground" />
          <div>
            <p className="font-display text-3xl leading-none tracking-wide">Blackthorn</p>
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-muted">Scream Park · CRM</p>
          </div>
        </div>

        <div className="panel p-5">
          <h1 className="text-base font-semibold">Staff sign in</h1>
          <div className="mt-4">
            <LoginForm next={next} demoLogins={demoLogins} password={password} />
          </div>
          {demoLogins.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              No staff accounts yet. Run <code className="rounded-[3px] bg-surface-raised px-1 py-px">npm run db:seed</code> to create the demo data.
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted">Demonstration system. No real emails, SMS or payments are sent.</p>
      </div>
    </main>
  );
}
