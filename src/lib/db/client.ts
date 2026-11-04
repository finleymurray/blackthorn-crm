import "server-only";
import postgres, { type Sql, type TransactionSql } from "postgres";
import type { StaffUser } from "@/lib/auth/types";

/**
 * Database access.
 *
 * Every request from a signed in staff member runs inside a transaction that
 * switches to the `authenticated` role and sets `request.jwt.claims` exactly
 * as Supabase's API gateway would. That means the row level security
 * policies in the migrations are enforced for the app's own queries too:
 * a marketing user cannot edit a ticket even if the UI had a bug.
 *
 * `adminSql` bypasses RLS and is reserved for the public web form, scheduled
 * automations and the seed script.
 */

declare global {
  var __blackthornSql: Sql | undefined;
}

function connect(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 15,
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    onnotice: () => {},
    transform: { undefined: null },
    // All CRM objects live in the crm schema; enum casts resolve through search_path.
    connection: { search_path: "crm, public, extensions" },
  });
}

export const adminSql: Sql = globalThis.__blackthornSql ?? (globalThis.__blackthornSql = connect());

export type Db = TransactionSql;

/**
 * Run `fn` as the given staff member, with RLS applied.
 */
export async function withStaff<T>(staff: StaffUser, fn: (db: Db) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: staff.id, role: "authenticated", email: staff.email });
  return adminSql.begin(async (tx) => {
    // One round trip: switch role and set the JWT claims together.
    await tx`select set_config('role', 'authenticated', true), set_config('request.jwt.claims', ${claims}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

/** Run `fn` without RLS (public web form, automations, seed). */
export async function withAdmin<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return adminSql.begin(async (tx) => fn(tx)) as Promise<T>;
}

export class DbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DbError";
  }
}

/** True when the error is a Postgres RLS / permission failure. */
export function isPermissionError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return code === "42501";
}
