import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSql } from "@/lib/db/client";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { LOCAL_DEV_COOKIE, localDevAuthEnabled } from "./local-dev";
import { canAccess, type StaffRole, type StaffUser } from "./types";

type StaffRow = { id: string; name: string; email: string; role: StaffRole; active: boolean };

async function loadStaffById(id: string): Promise<StaffUser | null> {
  const rows = await adminSql<StaffRow[]>`
    select id, name, email, role, active from crm.staff_users where id = ${id} and active`;
  return rows[0] ?? null;
}

async function loadStaffByEmail(email: string): Promise<StaffUser | null> {
  const rows = await adminSql<StaffRow[]>`
    select id, name, email, role, active from crm.staff_users where lower(email) = lower(${email}) and active`;
  return rows[0] ?? null;
}

/**
 * The signed in staff member, or null. Cached per request.
 */
export const getCurrentStaff = cache(async (): Promise<StaffUser | null> => {
  if (localDevAuthEnabled()) {
    const cookieStore = await cookies();
    const email = cookieStore.get(LOCAL_DEV_COOKIE)?.value;
    return email ? loadStaffByEmail(email) : null;
  }
  if (!supabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return loadStaffById(user.id);
});

/** Redirects to /login when signed out, and to the dashboard when the role may not open the page. */
export async function requireStaff(pathname?: string): Promise<StaffUser> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (pathname && !canAccess(staff.role, pathname)) redirect("/?denied=1");
  return staff;
}

export async function requireRole(...roles: StaffRole[]): Promise<StaffUser> {
  const staff = await requireStaff();
  if (!roles.includes(staff.role)) redirect("/?denied=1");
  return staff;
}
