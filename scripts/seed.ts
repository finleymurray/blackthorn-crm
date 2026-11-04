/**
 * Blackthorn CRM demo seed.
 *
 * Wipes every demo table and rebuilds a believable dataset from a fixed
 * random seed, so running it again produces exactly the same data.
 *
 *   npm run db:seed
 *
 * Needs DATABASE_URL. With NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY it also (re)creates the four demo staff accounts
 * in Supabase Auth. Without them it only writes staff_users rows, which is
 * enough for local development with LOCAL_DEV_AUTH=1.
 */
import "./load-env";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { Rng } from "./seed/rng";
import {
  FIRST_NAMES,
  LAST_NAMES,
  EMAIL_DOMAINS,
  POSTCODE_AREAS,
  TAGS,
  SURVEY_COMMENTS_POSITIVE,
  SURVEY_COMMENTS_MIXED,
  SURVEY_COMMENTS_NEGATIVE,
  NOTES_POOL,
  ACCESSIBILITY_NEEDS,
  BAN_REASONS,
} from "./seed/pools";
import { TICKET_TEMPLATES, NEW_INBOUND } from "./seed/tickets";
import { SAVED_REPLIES, AUTOMATIONS, SEGMENTS, CAMPAIGNS } from "./seed/templates";
import { MAZES, TICKET_TYPES, ADDONS, TICKET_CATEGORIES, ROOT_CAUSE_TAGS, SLA_HOURS } from "../src/lib/domain/constants";
import { renderMergeFields } from "../src/lib/messaging/merge";
import { renderBlocksToHtml, renderBlocksToText, renderPlainEmailHtml } from "../src/lib/messaging/email-blocks";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}
const sql = postgres(url, { max: 4, prepare: false, onnotice: () => {}, transform: { undefined: null }, connection: { search_path: "crm, public, extensions" } });
const rng = new Rng(20261031);

// "Now" for the demo is fixed so the data looks the same whenever it is seeded.
const NOW = new Date("2026-11-04T09:00:00Z");
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Blackthorn2026!";

const STAFF = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Eleanor Vance", email: "eleanor@blackthornscreampark.co.uk", role: "admin" },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Marcus Okafor", email: "marcus@blackthornscreampark.co.uk", role: "marketing" },
  { id: "a0000000-0000-4000-8000-000000000003", name: "Priya Shah", email: "priya@blackthornscreampark.co.uk", role: "support" },
  { id: "a0000000-0000-4000-8000-000000000004", name: "Tom Hardcastle", email: "tom@blackthornscreampark.co.uk", role: "front_desk" },
];

const BRAND = {
  parkName: "Blackthorn Scream Park",
  website: "https://blackthornscreampark.co.uk",
  address: "Blackthorn Farm, Oxton Road, Nottingham NG25 0RA",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

async function bulkInsert(table: string, rows: Row[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    await sql`insert into ${sql(table)} ${sql(slice)}`;
  }
}

function uuid(): string {
  // RFC4122 v4 from the deterministic RNG so ids are stable between runs.
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) s += hex[rng.int(0, 15)];
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${hex[8 + rng.int(0, 3)]}${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

/** Combine a date (YYYY-MM-DD) and a London local time (HH:MM) into a UTC instant. */
function londonInstant(date: string, time: string): Date {
  // October nights are BST (UTC+1) until the last Sunday of October, then GMT.
  const d = new Date(`${date}T${time}:00Z`);
  const year = d.getUTCFullYear();
  const lastSunOct = new Date(Date.UTC(year, 9, 31));
  lastSunOct.setUTCDate(31 - lastSunOct.getUTCDay());
  const lastSunMar = new Date(Date.UTC(year, 2, 31));
  lastSunMar.setUTCDate(31 - lastSunMar.getUTCDay());
  const bst = d >= lastSunMar && d < lastSunOct;
  return new Date(d.getTime() - (bst ? 60 : 0) * 60_000);
}

function ukDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function slugEmail(first: string, last: string, n: number): string {
  const domain = rng.weighted(EMAIL_DOMAINS);
  const styles = [
    `${first}.${last}`,
    `${first}${last}`,
    `${first[0]}${last}`,
    `${first}.${last}${rng.int(1, 99)}`,
    `${first}${rng.int(1980, 2004)}`,
    `${last}.${first}`,
  ];
  const base = styles[n % styles.length]!.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${base}@${domain}`;
}

function ukMobile(): string {
  return `07${rng.int(400, 999)} ${rng.int(100, 999)}${rng.int(100, 999)}`;
}

function postcode(): string {
  const [area, districts] = rng.weighted(POSTCODE_AREAS.map(([a, d, w]) => [[a, d] as const, w] as const));
  const district = rng.pick(districts);
  return `${area}${district} ${rng.int(0, 9)}${rng.code(2, "ABDEFGHJLNPQRSTUWXYZ")}`;
}

function bookingRef(existing: Set<string>): string {
  let ref: string;
  do {
    ref = `BTH-${rng.code(4)}`;
  } while (existing.has(ref));
  existing.add(ref);
  return ref;
}

function voucherCode(): string {
  return `BTV-${rng.code(5)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("Resetting demo data…");
  await sql.unsafe(`
    truncate table
      crm.activity_log, crm.vouchers, crm.refunds, crm.ticket_messages, crm.tickets,
      crm.messages_outbox, crm.campaigns, crm.segments, crm.automations, crm.saved_replies,
      crm.surveys, crm.bookings, crm.guests, crm.event_nights, crm.seasons,
      crm.mazes, crm.addons, crm.ticket_products, crm.staff_users, crm.sla_policies,
      crm.root_cause_tags, crm.ticket_categories
    restart identity cascade;
  `);
  await sql`update crm.park_settings set name = ${BRAND.parkName}, sender_name = ${BRAND.parkName},
    sender_email = 'hello@blackthornscreampark.co.uk', support_email = 'support@blackthornscreampark.co.uk',
    address = ${BRAND.address}, website = ${BRAND.website}, logo_url = null where id = 1`;

  // Staff --------------------------------------------------------------------
  const staffIds = await ensureStaff();
  const staffByRole = Object.fromEntries(STAFF.map((s) => [s.role, { ...s, id: staffIds[s.email]! }]));
  const support = staffByRole.support!;
  const admin = staffByRole.admin!;
  const marketing = staffByRole.marketing!;

  // Reference data -------------------------------------------------------------
  await bulkInsert(
    "ticket_categories",
    TICKET_CATEGORIES.map((c) => ({ key: c.key, label: c.label, default_priority: c.defaultPriority, sort_order: c.sortOrder })),
  );
  await bulkInsert("root_cause_tags", ROOT_CAUSE_TAGS.map((r) => ({ key: r.key, label: r.label })));
  await bulkInsert("sla_policies", Object.entries(SLA_HOURS).map(([priority, hours]) => ({ priority, hours })));
  await bulkInsert(
    "ticket_products",
    TICKET_TYPES.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      price_pence: { standard: 3000, fast_track: 4400, vip: 6900, group: 2600 }[t.key],
    })),
  );
  await bulkInsert("addons", ADDONS.map((a) => ({ key: a.key, name: a.name, price_pence: a.pricePence })));

  const mazeIds: Record<string, string> = {};
  await bulkInsert(
    "mazes",
    MAZES.map((m, i) => {
      const id = uuid();
      mazeIds[m.slug] = id;
      return { id, slug: m.slug, name: m.name, description: m.description, min_age: m.minAge, is_extreme: m.isExtreme, sort_order: (i + 1) * 10 };
    }),
  );

  // Seasons and nights -----------------------------------------------------------
  const seasons = [
    { id: uuid(), year: 2025, name: "Season 2025", starts_on: "2025-10-03", ends_on: "2025-11-01", is_current: false },
    { id: uuid(), year: 2026, name: "Season 2026", starts_on: "2026-10-02", ends_on: "2026-11-21", is_current: true },
  ];
  await bulkInsert("seasons", seasons);

  interface Night {
    id: string;
    season_id: string;
    year: number;
    date: string;
    capacity: number;
    status: string;
    weight: number;
    halloween: boolean;
    future: boolean;
  }
  const nights: Night[] = [];
  const buildNights = (year: number, seasonId: string) => {
    const start = new Date(Date.UTC(year, 9, 1));
    for (let d = 0; d < 31; d++) {
      const date = addDays(start, d);
      const dow = date.getUTCDay(); // 0 Sun .. 6 Sat
      const day = date.getUTCDate();
      const halloweenWeek = day >= 25 && day <= 31 && dow >= 1 && dow <= 4;
      const open = dow === 5 || dow === 6 || dow === 0 || halloweenWeek;
      if (!open) continue;
      const isHalloween = day === 31;
      let capacity = dow === 6 ? 1200 : dow === 5 ? 950 : dow === 0 ? 700 : 800;
      let weight = dow === 6 ? 1.7 : dow === 5 ? 1.2 : dow === 0 ? 0.7 : 0.9;
      if (isHalloween) {
        capacity = 1500;
        weight = 2.6;
      }
      if (day >= 24 && !isHalloween) weight *= 1.25;
      nights.push({ id: uuid(), season_id: seasonId, year, date: isoDate(date), capacity, status: "on_sale", weight, halloween: isHalloween, future: false });
    }
    if (year === 2025) {
      nights.push({ id: uuid(), season_id: seasonId, year, date: "2025-11-01", capacity: 1100, status: "on_sale", weight: 1.4, halloween: false, future: false });
    }
  };
  buildNights(2025, seasons[0]!.id);
  buildNights(2026, seasons[1]!.id);
  // Bonus November nights for 2026 so there is something upcoming to move bookings to.
  for (const date of ["2026-11-13", "2026-11-14", "2026-11-20", "2026-11-21"]) {
    nights.push({ id: uuid(), season_id: seasons[1]!.id, year: 2026, date, capacity: 600, status: "on_sale", weight: 0.35, halloween: false, future: true });
  }
  // One cancelled night (storm) in 2025 for realism.
  const cancelled = nights.find((n) => n.date === "2025-10-12")!;
  cancelled.status = "cancelled";
  cancelled.weight = 0;

  await bulkInsert(
    "event_nights",
    nights.map((n) => ({ id: n.id, season_id: n.season_id, date: n.date, capacity: n.capacity, status: n.status })),
  );

  // Guests ------------------------------------------------------------------------
  interface Guest {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    postcode: string;
    date_of_birth: string | null;
    email_consent: boolean;
    email_consent_at: Date | null;
    email_consent_source: string | null;
    sms_consent: boolean;
    sms_consent_at: Date | null;
    sms_consent_source: string | null;
    tags: string[];
    accessibility_needs: string | null;
    do_not_touch: boolean;
    banned: boolean;
    banned_reason: string | null;
    notes: string | null;
    created_at: Date;
    // internal
    kind: "first_timer" | "repeat" | "superfan";
    bookingsWanted: number;
    adult: boolean;
  }
  const guests: Guest[] = [];
  const usedEmails = new Set<string>();
  const GUEST_COUNT = 860;
  for (let i = 0; i < GUEST_COUNT; i++) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    let email = slugEmail(first, last, i);
    while (usedEmails.has(email)) email = slugEmail(first, last, i + rng.int(1, 1000));
    usedEmails.add(email);
    const kind = rng.weighted([
      ["first_timer", 48],
      ["repeat", 44],
      ["superfan", 8],
    ] as const);
    const bookingsWanted = kind === "first_timer" ? 1 : kind === "repeat" ? rng.int(2, 4) : rng.int(5, 9);
    const hasDob = rng.chance(0.55);
    const birthYear = rng.weighted([
      [rng.int(1998, 2008), 45],
      [rng.int(1985, 1997), 35],
      [rng.int(1965, 1984), 20],
    ]);
    const dob = hasDob ? `${birthYear}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}` : null;
    const emailConsent = rng.chance(0.68);
    const smsConsent = rng.chance(0.34);
    const created = addDays(new Date("2025-08-01T12:00:00Z"), rng.int(0, 440));
    const tags: string[] = [];
    if (kind === "superfan") tags.push("superfan");
    if (rng.chance(0.08)) tags.push(rng.pick(TAGS.filter((t) => t !== "superfan")));
    if (postcodeIsLocal()) tags.push("local");
    const g: Guest = {
      id: uuid(),
      first_name: first,
      last_name: last,
      email,
      phone: rng.chance(0.85) ? ukMobile() : null,
      postcode: postcode(),
      date_of_birth: dob,
      email_consent: emailConsent,
      email_consent_at: emailConsent ? created : rng.chance(0.3) ? addDays(created, rng.int(1, 100)) : null,
      email_consent_source: emailConsent ? rng.weighted([["booking", 70], ["web_form", 15], ["competition", 10], ["staff", 5]]) : null,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? created : null,
      sms_consent_source: smsConsent ? rng.weighted([["booking", 80], ["web_form", 15], ["staff", 5]]) : null,
      tags,
      accessibility_needs: rng.chance(0.02) ? rng.pick(ACCESSIBILITY_NEEDS) : null,
      do_not_touch: rng.chance(0.035),
      banned: false,
      banned_reason: null,
      notes: rng.chance(0.07) ? rng.pick(NOTES_POOL) : null,
      created_at: created,
      kind,
      bookingsWanted,
      adult: dob ? birthYear <= 2008 : true,
    };
    guests.push(g);
  }
  // Two banned guests, who were repeat visitors before.
  for (let i = 0; i < 2; i++) {
    const g = guests.filter((x) => x.kind === "repeat")[i * 37]!;
    g.banned = true;
    g.banned_reason = BAN_REASONS[i]!;
    g.bookingsWanted = 1;
  }
  function postcodeIsLocal() {
    return rng.chance(0.15);
  }

  // Bookings ------------------------------------------------------------------------
  interface Booking {
    id: string;
    reference: string;
    guest: Guest;
    night: Night;
    entry_time: string;
    ticket_type: string;
    group_size: number;
    addons: string[];
    total_paid_pence: number;
    refunded_pence: number;
    status: string;
    booked_at: Date;
    source_campaign_id: string | null;
  }
  const prices: Record<number, Record<string, number>> = {
    2025: { standard: 2800, fast_track: 4200, vip: 6500, group: 2400 },
    2026: { standard: 3000, fast_track: 4400, vip: 6900, group: 2600 },
  };
  const addonPrice = Object.fromEntries(ADDONS.map((a) => [a.key, a.pricePence]));
  const refs = new Set<string>();
  const bookings: Booking[] = [];
  const nightsByYear = (y: number) => nights.filter((n) => n.year === y && n.weight > 0);
  const slots = ["18:30", "18:45", "19:00", "19:15", "19:30", "19:45", "20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30"];

  for (const g of guests) {
    // Superfans come both years; first timers mostly 2026; repeats mixed.
    const years: number[] = [];
    if (g.kind === "superfan") {
      for (let i = 0; i < g.bookingsWanted; i++) years.push(i % 2 === 0 ? 2025 : 2026);
    } else if (g.kind === "first_timer") {
      years.push(rng.chance(0.72) ? 2026 : 2025);
    } else {
      for (let i = 0; i < g.bookingsWanted; i++) years.push(rng.chance(0.55) ? 2026 : 2025);
    }
    if (g.banned) years.splice(0, years.length, 2025);
    for (const year of years) {
      const pool = nightsByYear(year);
      const night = rng.weighted(pool.map((n) => [n, n.weight] as const));
      const ticket_type = rng.weighted([
        ["standard", 60],
        ["fast_track", 22],
        ["vip", g.adult ? 11 : 2],
        ["group", 7],
      ] as const);
      const group_size =
        ticket_type === "group" ? rng.int(10, 18) : rng.weighted([[1, 5], [2, 40], [3, 20], [4, 22], [5, 7], [6, 6]] as const);
      const addons: string[] = [];
      if (ticket_type !== "vip" && rng.chance(0.22)) addons.push("photo_pack");
      if (rng.chance(0.12)) addons.push("merch_bundle");
      if (rng.chance(0.3)) addons.push("food_voucher");
      const total = prices[year]![ticket_type]! * group_size + addons.reduce((s, a) => s + addonPrice[a]! * group_size, 0);
      const leadDays = night.future ? rng.int(1, 20) : rng.weighted([[rng.int(1, 7), 35], [rng.int(8, 30), 45], [rng.int(31, 70), 20]]);
      const bookedAt = addMinutes(londonInstant(night.date, "12:00"), -leadDays * 1440 + rng.int(-300, 600));
      const status = night.future
        ? "confirmed"
        : rng.weighted([
            ["confirmed", 92],
            ["no_show", 4],
            ["refunded", 2.5],
            ["transferred", 1.5],
          ] as const);
      bookings.push({
        id: uuid(),
        reference: bookingRef(refs),
        guest: g,
        night,
        entry_time: rng.weighted(slots.map((s, i) => [s, i < 4 || i > 9 ? 1 : 2.2] as const)),
        ticket_type,
        group_size,
        addons,
        total_paid_pence: total,
        refunded_pence: status === "refunded" ? total : 0,
        status,
        booked_at: bookedAt < g.created_at ? addMinutes(g.created_at, rng.int(5, 600)) : bookedAt,
        source_campaign_id: null,
      });
    }
  }
  console.log(`Generated ${guests.length} guests and ${bookings.length} bookings`);

  // Surveys --------------------------------------------------------------------------
  interface Survey {
    id: string;
    guest_id: string;
    booking_id: string;
    overall_score: number;
    maze_scores: Record<string, number>;
    comments: string | null;
    submitted_at: Date;
  }
  const surveys: Survey[] = [];
  // A booking counts as attended when the night has passed and it was not refunded or a no show.
  const attended = (b: Booking) => !b.night.future && b.status !== "no_show" && b.status !== "refunded";
  for (const b of bookings) {
    if (!attended(b) || !rng.chance(0.3)) continue;
    const halloweenPenalty = b.night.halloween ? 1.4 : 0;
    const overall = Math.max(1, Math.min(10, Math.round(rng.normal(8.1 - halloweenPenalty, 1.6))));
    const maze_scores: Record<string, number> = {};
    const canExtreme = b.guest.adult && !b.guest.do_not_touch && (b.ticket_type === "vip" || rng.chance(0.3));
    const rated = rng.shuffle(MAZES.map((m) => m.slug)).filter((slug) => slug !== "nightfall-manor" || canExtreme).slice(0, rng.int(3, 6));
    for (const slug of rated) {
      maze_scores[slug] = Math.max(1, Math.min(10, Math.round(rng.normal(overall + (slug === "ward-13" ? 0.6 : slug === "static" ? -0.4 : slug === "nightfall-manor" ? -0.5 : 0), 1.4))));
    }
    const comments =
      overall >= 8
        ? rng.chance(0.55)
          ? rng.pick(SURVEY_COMMENTS_POSITIVE)
          : null
        : overall >= 5
          ? rng.chance(0.7)
            ? rng.pick(SURVEY_COMMENTS_MIXED)
            : null
          : rng.pick(SURVEY_COMMENTS_NEGATIVE);
    surveys.push({
      id: uuid(),
      guest_id: b.guest.id,
      booking_id: b.id,
      overall_score: overall,
      maze_scores,
      comments,
      submitted_at: addMinutes(londonInstant(b.night.date, "10:00"), 1440 + rng.int(5, 2800)),
    });
  }
  console.log(`Generated ${surveys.length} surveys`);

  // Guest denormalised stats ----------------------------------------------------------
  const stats = new Map<string, { spend: number; visits: number; first: string | null; last: string | null }>();
  for (const b of bookings) {
    const s = stats.get(b.guest.id) ?? { spend: 0, visits: 0, first: null, last: null };
    if (b.status !== "refunded") s.spend += b.total_paid_pence - b.refunded_pence;
    if (attended(b)) {
      s.visits += 1;
      if (!s.first || b.night.date < s.first) s.first = b.night.date;
      if (!s.last || b.night.date > s.last) s.last = b.night.date;
    }
    stats.set(b.guest.id, s);
  }

  await bulkInsert(
    "guests",
    guests.map((g) => {
      const s = stats.get(g.id) ?? { spend: 0, visits: 0, first: null, last: null };
      const { kind: _k, bookingsWanted: _b, adult: _a, ...row } = g;
      void _k; void _b; void _a;
      return { ...row, lifetime_spend_pence: s.spend, visit_count: s.visits, first_visit_on: s.first, last_visit_on: s.last };
    }),
  );
  await bulkInsert(
    "bookings",
    bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      guest_id: b.guest.id,
      event_night_id: b.night.id,
      entry_time: b.entry_time,
      ticket_type: b.ticket_type,
      group_size: b.group_size,
      addons: b.addons,
      total_paid_pence: b.total_paid_pence,
      refunded_pence: b.refunded_pence,
      status: b.status,
      booked_at: b.booked_at,
      created_at: b.booked_at,
    })),
  );
  // Mark sold out nights from real demand.
  await sql.unsafe(`
    update crm.event_nights n set status = 'sold_out'
    where status = 'on_sale' and date < '2026-11-04' and (
      select coalesce(sum(group_size), 0) from crm.bookings b where b.event_night_id = n.id and b.status <> 'refunded'
    ) >= n.capacity * 0.55`);
  await bulkInsert("surveys", surveys.map((s) => ({ ...s, maze_scores: sql.json(s.maze_scores) })));

  // Marketing: segments, campaigns, automations ------------------------------------------
  const segmentIds: Record<string, string> = {};
  await bulkInsert(
    "segments",
    SEGMENTS.map((s) => {
      const id = uuid();
      segmentIds[s.name] = id;
      return { id, name: s.name, description: s.description, rules: sql.json(s.rules as never), created_by: marketing.id, created_at: "2026-08-20T10:00:00Z" };
    }),
  );

  const automationIds: Record<string, string> = {};
  await bulkInsert(
    "automations",
    AUTOMATIONS.map((a) => {
      const id = uuid();
      automationIds[a.trigger] = id;
      return {
        id,
        trigger: a.trigger,
        name: a.name,
        description: a.description,
        channel: a.channel,
        delay_minutes: a.delay_minutes,
        send_at_time: "send_at_time" in a ? a.send_at_time : null,
        subject: a.subject,
        body: a.body,
        active: a.trigger !== "win_back",
      };
    }),
  );

  // Outbox: automation sends ---------------------------------------------------------------
  const outbox: Row[] = [];
  const ticketTypeName = Object.fromEntries(TICKET_TYPES.map((t) => [t.key, t.name]));
  const mergeFor = (b: Booking) => ({
    first_name: b.guest.first_name,
    last_name: b.guest.last_name,
    full_name: `${b.guest.first_name} ${b.guest.last_name}`,
    email: b.guest.email,
    booking_reference: b.reference,
    visit_date: ukDate(b.night.date),
    entry_time: b.entry_time,
    ticket_type: ticketTypeName[b.ticket_type]!,
    group_size: b.group_size,
    park_name: BRAND.parkName,
    survey_link: `${BRAND.website}/survey/${b.reference}`,
    booking_link: `${BRAND.website}/tickets`,
  });
  const pushEmail = (b: Booking, auto: (typeof AUTOMATIONS)[number], sentAt: Date, opts: { opened?: boolean } = {}) => {
    const values = mergeFor(b);
    const text = renderMergeFields(auto.body, values);
    const opened = opts.opened ?? rng.chance(0.62);
    outbox.push({
      id: uuid(),
      channel: "email",
      guest_id: b.guest.id,
      recipient_name: values.full_name,
      recipient: b.guest.email,
      subject: renderMergeFields(auto.subject, values),
      body_html: renderPlainEmailHtml(text, BRAND),
      body_text: text,
      automation_id: automationIds[auto.trigger]!,
      status: "sent",
      sent_at: sentAt,
      opened_at: opened ? addMinutes(sentAt, rng.int(3, 1800)) : null,
      clicked_at: opened && rng.chance(0.3) ? addMinutes(sentAt, rng.int(5, 2000)) : null,
      created_at: sentAt,
    });
  };
  const confirmAuto = AUTOMATIONS[0];
  const reminderAuto = AUTOMATIONS[1];
  const surveyAuto = AUTOMATIONS[2];
  for (const b of bookings) {
    pushEmail(b, confirmAuto, addMinutes(b.booked_at, 1), { opened: rng.chance(0.9) });
    const visitStart = londonInstant(b.night.date, b.entry_time);
    const reminderAt = addMinutes(visitStart, -2880);
    if (b.night.year === 2026 && reminderAt > b.booked_at && reminderAt < NOW && b.status !== "refunded") pushEmail(b, reminderAuto, reminderAt);
    if (attended(b) && b.night.year === 2026) {
      const morningAfter = addMinutes(londonInstant(b.night.date, "10:00"), 1440);
      if (morningAfter < NOW) pushEmail(b, surveyAuto, morningAfter);
    }
  }

  // Campaigns and their sends ----------------------------------------------------------------
  const campaignRows: Row[] = [];
  for (const c of CAMPAIGNS) {
    const id = uuid();
    const segmentId = segmentIds[c.segment]!;
    let statsJson: Row = {};
    if (c.status === "sent") {
      const sentAt = new Date(c.sent_at!);
      // Recipients: evaluate the segment roughly here (the app does it in SQL).
      const audience = guests.filter((g) => segmentMatches(c.segment, g));
      const consented = audience.filter((g) => (c.channel === "email" ? g.email_consent : g.sms_consent && g.phone));
      const excludedNoConsent = audience.length - consented.length;
      let opens = 0;
      let clicks = 0;
      for (const g of consented) {
        const bookingsOfGuest = bookings.filter((b) => b.guest.id === g.id);
        const lastBooking = bookingsOfGuest.sort((a, b) => b.booked_at.getTime() - a.booked_at.getTime())[0];
        const values = {
          first_name: g.first_name,
          last_name: g.last_name,
          full_name: `${g.first_name} ${g.last_name}`,
          email: g.email,
          park_name: BRAND.parkName,
          booking_reference: lastBooking?.reference ?? "",
        };
        const opened = c.channel === "email" ? rng.chance(0.41) : rng.chance(0.93);
        const clicked = opened && rng.chance(c.channel === "email" ? 0.19 : 0.12);
        if (opened) opens++;
        if (clicked) clicks++;
        if (c.channel === "email") {
          outbox.push({
            id: uuid(),
            channel: "email",
            guest_id: g.id,
            recipient_name: values.full_name,
            recipient: g.email,
            subject: renderMergeFields(c.subject!, values),
            body_html: renderBlocksToHtml(c.blocks!, values, BRAND),
            body_text: renderBlocksToText(c.blocks!, values),
            campaign_id: id,
            status: "sent",
            sent_at: addMinutes(sentAt, rng.int(0, 25)),
            opened_at: opened ? addMinutes(sentAt, rng.int(5, 2600)) : null,
            clicked_at: clicked ? addMinutes(sentAt, rng.int(10, 3000)) : null,
            created_at: sentAt,
          });
        } else {
          const text = renderMergeFields(c.sms_body!, values);
          outbox.push({
            id: uuid(),
            channel: "sms",
            guest_id: g.id,
            recipient_name: values.full_name,
            recipient: g.phone,
            subject: null,
            body_html: null,
            body_text: text,
            campaign_id: id,
            status: "sent",
            sent_at: addMinutes(sentAt, rng.int(0, 12)),
            opened_at: opened ? addMinutes(sentAt, rng.int(1, 300)) : null,
            clicked_at: clicked ? addMinutes(sentAt, rng.int(2, 400)) : null,
            created_at: sentAt,
          });
        }
        // Attribute bookings made within 14 days of the send.
        for (const b of bookingsOfGuest) {
          const delta = b.booked_at.getTime() - sentAt.getTime();
          if (delta > 0 && delta < 14 * 86_400_000) b.source_campaign_id = id;
        }
      }
      const attributed = bookings.filter((b) => b.source_campaign_id === id);
      statsJson = {
        audience: audience.length,
        recipients: consented.length,
        excluded: excludedNoConsent,
        excluded_reasons: { [c.channel === "email" ? "no_email_consent" : "no_sms_consent"]: excludedNoConsent },
        opens,
        clicks,
        bookings_after: attributed.length,
        revenue_after_pence: attributed.reduce((s, b) => s + b.total_paid_pence, 0),
      };
    }
    campaignRows.push({
      id,
      name: c.name,
      channel: c.channel,
      segment_id: segmentId,
      subject: c.subject ?? null,
      preheader: c.preheader ?? null,
      blocks: sql.json((c.blocks ?? []) as never),
      sms_body: c.sms_body ?? null,
      status: c.status,
      scheduled_for: c.scheduled_for ?? null,
      sent_at: c.sent_at ?? null,
      stats: sql.json(statsJson as never),
      created_by: marketing.id,
      created_at: c.sent_at ?? c.scheduled_for ?? "2026-10-28T14:00:00Z",
    });
  }
  await bulkInsert("campaigns", campaignRows);
  // Write attribution back to bookings.
  for (const b of bookings) {
    if (b.source_campaign_id) await sql`update crm.bookings set source_campaign_id = ${b.source_campaign_id} where id = ${b.id}`;
  }

  function segmentMatches(name: string, g: Guest): boolean {
    const gb = bookings.filter((b) => b.guest.id === g.id);
    switch (name) {
      case "Big spenders": {
        const s = stats.get(g.id);
        return !!s && (s.spend > 15000 || s.visits > 2);
      }
      case "Nottingham locals":
        return g.postcode.startsWith("NG") && g.email_consent;
      case "2025 guests not yet booked for 2026":
        return gb.some((b) => b.night.year === 2025 && attended(b)) && !gb.some((b) => b.night.year === 2026);
      case "Happy guests with SMS consent":
        return g.sms_consent && !!g.phone && surveys.some((s) => s.guest_id === g.id && s.overall_score >= 8);
      case "VIP and Fast Track buyers":
        return gb.some((b) => b.ticket_type === "vip" || b.ticket_type === "fast_track");
      default:
        return false;
    }
  }

  // Saved replies --------------------------------------------------------------------------
  await bulkInsert("saved_replies", SAVED_REPLIES.map((r, i) => ({ ...r, sort_order: (i + 1) * 10 })));

  // Support tickets ------------------------------------------------------------------------
  const ticketRows: Row[] = [];
  const messageRows: Row[] = [];
  const refundRows: Row[] = [];
  const voucherRows: Row[] = [];
  const activity: Row[] = [];
  const pastBookings = bookings.filter((b) => !b.night.future && b.status !== "refunded" && !b.guest.banned);
  const staffNames: Record<string, string> = { support: "Priya", admin: "Eleanor" };

  const TICKET_COUNT = 62;
  const templateUses = new Map<number, number>();
  for (let i = 0; i < TICKET_COUNT; i++) {
    const tplIndex = i % TICKET_TEMPLATES.length;
    const tpl = TICKET_TEMPLATES[tplIndex]!;
    const uses = templateUses.get(tplIndex) ?? 0;
    templateUses.set(tplIndex, uses + 1);
    const booking = rng.pick(pastBookings);
    const guest = booking.guest;
    // Spread: most in Oct/Nov 2026, some older ones resolved. A complaint
    // template is only ever "live" once; repeats are historical.
    const old = i % 7 === 3 || (tpl.category === "complaint" && uses > 0);
    const priority = tpl.priority;
    const slaHours = SLA_HOURS[priority];
    const replied = tpl.thread.some((m) => m.direction === "outbound");
    // Status logic: templates with no reply are new/open; replied threads mostly resolved,
    // some waiting on guest. Keep a handful overdue for the dashboard.
    // Anything the team has replied to is resolved. Only unanswered threads stay in the queue.
    let status: string;
    if (old || replied) status = "resolved";
    else status = rng.weighted([["new", 70], ["open", 30]] as const);
    // Resolved tickets spread across the season; open ones are recent so the
    // inbox looks live rather than abandoned.
    const createdAt = old
      ? addMinutes(londonInstant(booking.night.year === 2025 ? booking.night.date : "2025-10-18", "10:00"), rng.int(600, 4000))
      : status === "resolved"
        ? addMinutes(new Date("2026-10-03T08:00:00Z"), rng.int(0, 30 * 1440))
        : status === "new"
          ? addMinutes(NOW, -rng.int(20, 20 * 60))
          : addMinutes(NOW, -rng.int(3 * 60, 2 * 1440));
    const slaDue = addMinutes(createdAt, slaHours * 60);
    const ticketId = uuid();
    const assigned = status === "new" ? null : tpl.priority === "urgent" ? admin.id : support.id;
    const values = {
      first_name: guest.first_name,
      booking_reference: booking.reference,
      visit_date: ukDate(booking.night.date),
      staff_name: assigned === admin.id ? staffNames.admin : staffNames.support,
    };
    let t = createdAt;
    let firstResponse: Date | null = null;
    tpl.thread.forEach((m, idx) => {
      if (idx > 0) t = addMinutes(t, m.direction === "inbound" ? rng.int(60, 1500) : rng.int(25, slaHours * 45));
      if (m.direction === "outbound" && !firstResponse) firstResponse = t;
      messageRows.push({
        id: uuid(),
        ticket_id: ticketId,
        direction: m.direction,
        author_staff_id: m.direction === "inbound" ? null : assigned ?? support.id,
        author_name: m.direction === "inbound" ? `${guest.first_name} ${guest.last_name}` : assigned === admin.id ? admin.name : support.name,
        body: renderMergeFields(m.body, values),
        sent_at: t,
        created_at: t,
      });
    });
    const resolvedAt = status === "resolved" ? addMinutes(t, rng.int(5, 240)) : null;
    const isComplaint = tpl.category === "complaint";
    ticketRows.push({
      id: ticketId,
      guest_id: guest.id,
      requester_name: `${guest.first_name} ${guest.last_name}`,
      requester_email: guest.email,
      booking_id: tpl.needsBooking ? booking.id : null,
      subject: renderMergeFields(tpl.subject, values),
      category: tpl.category,
      priority,
      status,
      assigned_to: assigned,
      source: i % 4 === 0 ? "web_form" : "email",
      sla_due_at: slaDue,
      first_response_at: firstResponse,
      resolved_at: resolvedAt,
      root_cause: isComplaint && status === "resolved" ? tpl.rootCause ?? "queue_times" : null,
      final_response: isComplaint && status === "resolved" ? tpl.finalResponse ?? "Resolved with the guest by phone." : null,
      created_at: createdAt,
      updated_at: resolvedAt ?? t,
    });
    // Simulated actions on some resolved refund tickets.
    if (tpl.category === "refund" && status === "resolved" && tpl.subject.includes("twice")) {
      refundRows.push({ id: uuid(), booking_id: booking.id, ticket_id: ticketId, amount_pence: booking.total_paid_pence, reason: "Duplicate payment", processed_by: support.id, provider_reference: `sim_${rng.code(10)}`, created_at: resolvedAt ?? t });
    }
    if ((tpl.subject.includes("Rained") || tpl.subject.includes("hospital")) && status === "resolved") {
      const amount = tpl.subject.includes("Rained") ? Math.round(booking.total_paid_pence / 2) : booking.total_paid_pence;
      voucherRows.push({ id: uuid(), code: voucherCode(), guest_id: guest.id, ticket_id: ticketId, amount_pence: amount, reason: tpl.subject, expires_on: "2027-11-30", issued_by: support.id, created_at: resolvedAt ?? t });
      activity.push({ staff_id: support.id, staff_name: support.name, action: "voucher.issued", entity_type: "ticket", entity_id: ticketId, summary: `Issued a voucher for £${(amount / 100).toFixed(2)}`, details: sql.json({ amount_pence: amount }), created_at: resolvedAt ?? t });
    }
    if (status === "resolved") {
      activity.push({ staff_id: assigned ?? support.id, staff_name: assigned === admin.id ? admin.name : support.name, action: "ticket.resolved", entity_type: "ticket", entity_id: ticketId, summary: `Resolved ticket "${renderMergeFields(tpl.subject, values)}"`, details: sql.json({}), created_at: resolvedAt });
    }
  }
  // A queue of fresh, unanswered emails to work through, arriving over the last 36 hours.
  const freshBookings = bookings.filter((b) => b.status !== "refunded" && !b.guest.banned);
  NEW_INBOUND.forEach((tpl, i) => {
    const booking = rng.pick(freshBookings);
    const guest = booking.guest;
    const priority = tpl.priority ?? (TICKET_CATEGORIES.find((c) => c.key === tpl.category)?.defaultPriority ?? "normal");
    const createdAt = addMinutes(NOW, -(rng.chance(0.7) ? rng.int(15, 7 * 60) : rng.int(7 * 60, 36 * 60)));
    const ticketId = uuid();
    const values = { first_name: guest.first_name, last_name: guest.last_name, booking_reference: booking.reference, visit_date: ukDate(booking.night.date) };
    messageRows.push({ id: uuid(), ticket_id: ticketId, direction: "inbound", author_staff_id: null, author_name: `${guest.first_name} ${guest.last_name}`, body: renderMergeFields(tpl.body, values), sent_at: createdAt, created_at: createdAt });
    ticketRows.push({
      id: ticketId,
      guest_id: guest.id,
      requester_name: `${guest.first_name} ${guest.last_name}`,
      requester_email: guest.email,
      booking_id: tpl.body.includes("{{booking_reference}}") ? booking.id : null,
      subject: renderMergeFields(tpl.subject, values),
      category: tpl.category,
      priority,
      status: "new",
      assigned_to: null,
      source: tpl.source,
      sla_due_at: addMinutes(createdAt, SLA_HOURS[priority as keyof typeof SLA_HOURS] * 60),
      first_response_at: null,
      resolved_at: null,
      root_cause: null,
      final_response: null,
      created_at: createdAt,
      updated_at: createdAt,
    });
    void i;
  });

  // Make sure the SLA story is interesting: a few open tickets are clearly overdue, a few due soon.
  const openTickets = ticketRows.filter((t) => t.status !== "resolved");
  openTickets.slice(0, 4).forEach((t, i) => {
    t.created_at = addMinutes(NOW, -(26 + i * 9) * 60);
    t.sla_due_at = addMinutes(t.created_at as Date, SLA_HOURS[t.priority as keyof typeof SLA_HOURS] * 60);
  });
  openTickets.slice(4, 8).forEach((t, i) => {
    t.created_at = addMinutes(NOW, -(SLA_HOURS[t.priority as keyof typeof SLA_HOURS] * 60 - 35 - i * 25));
    t.sla_due_at = addMinutes(t.created_at as Date, SLA_HOURS[t.priority as keyof typeof SLA_HOURS] * 60);
  });
  // Re-time the messages of adjusted tickets so the thread sits after creation.
  for (const t of openTickets.slice(0, 8)) {
    const msgs = messageRows.filter((m) => m.ticket_id === t.id);
    let at = t.created_at as Date;
    for (const m of msgs) {
      m.sent_at = at;
      m.created_at = at;
      at = addMinutes(at, rng.int(30, 240));
    }
    t.updated_at = at;
  }

  await bulkInsert("tickets", ticketRows);
  await bulkInsert("ticket_messages", messageRows);
  await bulkInsert("refunds", refundRows);
  await bulkInsert("vouchers", voucherRows);

  // Ticket replies also land in the outbox (that's how the guest got them).
  for (const m of messageRows.filter((m) => m.direction === "outbound")) {
    const t = ticketRows.find((x) => x.id === m.ticket_id)!;
    outbox.push({
      id: uuid(),
      channel: "email",
      guest_id: t.guest_id,
      recipient_name: t.requester_name,
      recipient: t.requester_email,
      subject: `Re: ${t.subject}`,
      body_html: renderPlainEmailHtml(m.body as string, BRAND),
      body_text: m.body,
      ticket_id: t.id,
      status: "sent",
      sent_at: m.sent_at,
      opened_at: rng.chance(0.8) ? addMinutes(m.sent_at as Date, rng.int(2, 900)) : null,
      created_at: m.sent_at,
    });
  }
  outbox.sort((a, b) => (a.sent_at as Date).getTime() - (b.sent_at as Date).getTime());
  await bulkInsert("messages_outbox", outbox);
  console.log(`Generated ${ticketRows.length} tickets, ${messageRows.length} messages and ${outbox.length} outbox entries`);

  // Activity log: some staff actions on guests for the audit trail -------------------------
  const someGuests = rng.shuffle(guests).slice(0, 25);
  someGuests.forEach((g, i) => {
    const at = addMinutes(new Date("2026-10-05T09:00:00Z"), rng.int(0, 28 * 1440));
    const kinds = [
      { staff: support, action: "guest.note_added", summary: "Added a note" },
      { staff: marketing, action: "guest.tags_updated", summary: `Added tag "${rng.pick(TAGS)}"` },
      { staff: support, action: "guest.consent_updated", summary: "Updated SMS consent: opted out (guest request)" },
      { staff: admin, action: "guest.updated", summary: "Updated phone number" },
    ];
    const k = kinds[i % kinds.length]!;
    activity.push({ staff_id: k.staff.id, staff_name: k.staff.name, action: k.action, entity_type: "guest", entity_id: g.id, summary: k.summary, details: sql.json({}), created_at: at });
  });
  activity.push({ staff_id: marketing.id, staff_name: marketing.name, action: "campaign.sent", entity_type: "campaign", entity_id: campaignRows[0]!.id, summary: `Sent campaign "${CAMPAIGNS[0]!.name}"`, details: sql.json({}), created_at: CAMPAIGNS[0]!.sent_at });
  activity.push({ staff_id: marketing.id, staff_name: marketing.name, action: "campaign.sent", entity_type: "campaign", entity_id: campaignRows[1]!.id, summary: `Sent campaign "${CAMPAIGNS[1]!.name}"`, details: sql.json({}), created_at: CAMPAIGNS[1]!.sent_at });
  activity.sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());
  await bulkInsert("activity_log", activity);

  // Summary ---------------------------------------------------------------------------------
  const [counts] = await sql<{ guests: number; bookings: number; surveys: number; tickets: number; outbox: number }[]>`
    select
      (select count(*) from crm.guests)::int as guests,
      (select count(*) from crm.bookings)::int as bookings,
      (select count(*) from crm.surveys)::int as surveys,
      (select count(*) from crm.tickets)::int as tickets,
      (select count(*) from crm.messages_outbox)::int as outbox`;
  console.log("\nSeed complete:");
  console.table(counts);
  console.log("\nDemo logins (password: " + DEMO_PASSWORD + ")");
  for (const s of STAFF) console.log(`  ${s.role.padEnd(11)} ${s.email}`);
}

/** Create or refresh the demo staff in Supabase Auth (when configured) and staff_users. */
async function ensureStaff(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    console.log("Creating demo staff accounts in Supabase Auth…");
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;
    for (const s of STAFF) {
      const existing = list.users.find((u) => u.email?.toLowerCase() === s.email);
      if (existing) {
        const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name: s.name } });
        if (error) throw error;
        ids[s.email] = existing.id;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({ email: s.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name: s.name } });
        if (error) throw error;
        ids[s.email] = data.user.id;
      }
    }
  } else {
    console.log("Supabase service key not set: creating staff_users only (local development auth).");
    for (const s of STAFF) ids[s.email] = s.id;
  }
  await bulkInsert("staff_users", STAFF.map((s) => ({ id: ids[s.email], name: s.name, email: s.email, role: s.role })));
  return ids;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sql.end());
