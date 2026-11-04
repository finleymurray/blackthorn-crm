import type { Metadata } from "next";
import { ThornMark } from "@/components/brand/logo";
import { LoginForm } from "./login-form";
import { adminSql } from "@/lib/db/client";
import { ROLE_LABELS, type StaffRole } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

async function loadDemoLogins() {
  try {
    const rows = await adminSql<{ name: string; email: string; role: StaffRole }[]>`
      select name, email, role from public.staff_users where active
      order by array_position(array['admin','marketing','support','front_desk']::staff_role[], role)`;
    return rows;
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
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <ThornMark className="size-12 text-foreground" />
          <h1 className="font-display mt-4 text-4xl tracking-wide sm:text-5xl">Blackthorn</h1>
          <p className="mt-1 text-sm uppercase tracking-[0.3em] text-muted">Scream Park CRM</p>
        </div>

        <div className="rounded-lg border border-border bg-surface/90 p-6 shadow-2xl backdrop-blur">
          <h2 className="text-base font-semibold">Staff sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your Blackthorn staff account.</p>
          <div className="mt-5">
            <LoginForm next={next} />
          </div>
        </div>

        {demoLogins.length > 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface/60 p-4 text-sm">
            <p className="font-medium">Demo logins</p>
            <p className="mt-0.5 text-xs text-muted">
              Password for every account: <code className="rounded bg-background px-1.5 py-0.5 text-foreground">{password}</code>
            </p>
            <ul className="mt-3 divide-y divide-border">
              {demoLogins.map((s) => (
                <li key={s.email} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted">{s.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-strong">{ROLE_LABELS[s.role]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-center text-xs text-muted">
            No staff accounts yet. Run <code className="rounded bg-surface px-1 py-0.5">npm run db:seed</code> to create the demo data.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          Demo system. No real emails, SMS or payments are ever sent.
        </p>
      </div>
    </main>
  );
}
