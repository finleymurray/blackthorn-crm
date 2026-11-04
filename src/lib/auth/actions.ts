"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSql } from "@/lib/db/client";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";
import { LOCAL_DEV_COOKIE, localDevAuthEnabled } from "./local-dev";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again" };
  }
  const { email, password } = parsed.data;
  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/";

  if (localDevAuthEnabled()) {
    const rows = await adminSql<{ email: string }[]>`
      select email from crm.staff_users where lower(email) = lower(${email}) and active`;
    if (!rows[0]) return { error: "No staff account with that email" };
    const expected = process.env.DEMO_PASSWORD ?? "Blackthorn2026!";
    if (password !== expected) return { error: "Incorrect password" };
    const cookieStore = await cookies();
    cookieStore.set(LOCAL_DEV_COOKIE, rows[0].email, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(next);
  }

  if (!supabaseConfigured()) {
    return { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." };
  }

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message === "Invalid login credentials" ? "Incorrect email or password" : error.message };
  }
  const staff = await adminSql<{ id: string }[]>`
    select id from crm.staff_users where id = ${data.user.id} and active`;
  if (!staff[0]) {
    await supabase.auth.signOut();
    return { error: "This account is not a Blackthorn staff user" };
  }
  redirect(next);
}

export async function signOut() {
  if (localDevAuthEnabled()) {
    const cookieStore = await cookies();
    cookieStore.delete(LOCAL_DEV_COOKIE);
  } else if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
