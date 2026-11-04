/**
 * Applies every file in supabase/migrations in order, tracking what has run
 * in crm.schema_migrations. Works against Supabase or a plain Postgres.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --reset drop the public schema first (destructive)
 */
import "./load-env";
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const reset = process.argv.includes("--reset");
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connection: { search_path: "crm, public, extensions" } });

async function main() {
  if (reset) {
    console.log("Resetting the crm schema…");
    await sql.unsafe(`drop schema if exists crm cascade;`);
  }

  // Local Postgres has no auth schema. Supabase always does.
  const [{ exists: hasAuthUid }] = await sql<{ exists: boolean }[]>`
    select exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'auth' and p.proname = 'uid'
    )`;
  if (!hasAuthUid) {
    console.log("No auth.uid() found: applying the local auth shim (plain Postgres).");
    const shim = readFileSync(path.join(__dirname, "../supabase/local/auth_shim.sql"), "utf8");
    await sql.unsafe(shim);
  }

  await sql.unsafe(`
    create schema if not exists crm;
    create table if not exists crm.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`);

  const applied = new Set(
    (await sql<{ name: string }[]>`select name from crm.schema_migrations`).map((r) => r.name),
  );

  const dir = path.join(__dirname, "../supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`Applying ${file}…`);
    const body = readFileSync(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into crm.schema_migrations (name) values (${file})`;
    });
  }
  console.log(`Database is up to date (${files.length} migration${files.length === 1 ? "" : "s"}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sql.end());
