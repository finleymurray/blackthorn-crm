/**
 * Integration tests that run the compiled SQL against a real database.
 * Skipped unless DATABASE_URL points at a seeded Blackthorn database.
 */
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { compileSegment } from "./compile";
import { exclusionReason, exclusionReasonSql, type ConsentFacts } from "./consent";

const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 1, prepare: false, onnotice: () => {}, connection: { search_path: "crm, public, extensions" } }) : null;

describe.skipIf(!sql)("segment SQL against the database", () => {
  it("visited_season matches guests with an attended booking in that season", async () => {
    const { where, params } = compileSegment({ op: "and", rules: [{ type: "visited_season", season_year: 2025 }] });
    const [{ count }] = await sql!.unsafe<{ count: number }[]>(`select count(*)::int as count from crm.guests g where ${where}`, params as never[]);
    const [{ expected }] = await sql!`
      select count(distinct b.guest_id)::int as expected from crm.bookings b
      join crm.event_nights n on n.id = b.event_night_id join crm.seasons s on s.id = n.season_id
      where s.year = 2025 and b.status in ('confirmed','transferred') and n.date <= current_date`;
    expect(count).toBe(expected);
    expect(count).toBeGreaterThan(0);
  });

  it("negated and nested rules return a subset", async () => {
    const all = compileSegment({ op: "and", rules: [{ type: "visited_season", season_year: 2025 }] });
    const sub = compileSegment({
      op: "and",
      rules: [
        { type: "visited_season", season_year: 2025 },
        { type: "booked_season", season_year: 2026, negate: true },
        { op: "or", rules: [{ type: "email_consent", value: true }, { type: "sms_consent", value: true }] },
      ],
    });
    const [{ a }] = await sql!.unsafe<{ a: number }[]>(`select count(*)::int as a from crm.guests g where ${all.where}`, all.params as never[]);
    const [{ b }] = await sql!.unsafe<{ b: number }[]>(`select count(*)::int as b from crm.guests g where ${sub.where}`, sub.params as never[]);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(a);
  });

  it("every rule type compiles to valid SQL", async () => {
    const rules = [
      { type: "visited_season", season_year: 2026 },
      { type: "booked_season", season_year: 2026 },
      { type: "booked_ticket_type", ticket_type: "vip" },
      { type: "lifetime_spend", op: "lt", pence: 5000 },
      { type: "visit_count", op: "eq", value: 1 },
      { type: "postcode_starts", value: "NG" },
      { type: "email_consent", value: false },
      { type: "sms_consent", value: true },
      { type: "has_tag", tag: "superfan" },
      { type: "survey_score", op: "lt", value: 5 },
      { type: "last_visit_days", op: "within", days: 400 },
      { type: "last_visit_days", op: "older_than", days: 30 },
      { type: "bought_addon", addon: "photo_pack", negate: true },
    ];
    for (const rule of rules) {
      const { where, params } = compileSegment({ op: "and", rules: [rule] });
      const [{ count }] = await sql!.unsafe<{ count: number }[]>(`select count(*)::int as count from crm.guests g where ${where}`, params as never[]);
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it("SQL exclusion reasons agree with the TypeScript rules for every guest", async () => {
    for (const channel of ["email", "sms"] as const) {
      const rows = await sql!.unsafe<(ConsentFacts & { reason: string | null })[]>(
        `select g.banned, g.email_consent, g.sms_consent, g.email, g.phone, ${exclusionReasonSql(channel)} as reason from crm.guests g`,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) expect(r.reason).toBe(exclusionReason(r, channel));
    }
  });
});
