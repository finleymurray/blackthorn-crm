import { adminSql } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Liveness check for always-on hosts. Also reports how long one round trip
 * to the database takes, which is the number that decides how fast pages feel.
 */
export async function GET() {
  const started = performance.now();
  try {
    await adminSql`select 1`;
    const dbMs = Math.round(performance.now() - started);
    return Response.json({ ok: true, db_ms: dbMs }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
