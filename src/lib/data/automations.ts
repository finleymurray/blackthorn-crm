import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { renderMergeFields, type MergeValues } from "@/lib/messaging/merge";
import { renderPlainEmailHtml } from "@/lib/messaging/email-blocks";
import { sendEmail, sendSms } from "@/lib/messaging/provider";
import { brandingFrom, getParkSettings } from "./settings";
import { eligibleRecipients } from "./segments";

export type AutomationTrigger = "booking_confirmed" | "reminder_48h" | "post_visit_survey" | "win_back";

export interface AutomationRow {
  id: string;
  trigger: AutomationTrigger;
  name: string;
  description: string;
  channel: "email" | "sms";
  delay_minutes: number;
  send_at_time: string | null;
  subject: string | null;
  body: string;
  active: boolean;
  sent_count: number;
  last_sent_at: Date | null;
  updated_at: Date;
}

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  booking_confirmed: "When a booking is made",
  reminder_48h: "Before the visit",
  post_visit_survey: "The morning after a visit",
  win_back: "September, guests who came last season but have not booked",
};

export async function listAutomations(db: Db): Promise<AutomationRow[]> {
  return db<AutomationRow[]>`
    select a.id, a.trigger::text as trigger, a.name, a.description, a.channel::text as channel, a.delay_minutes, a.send_at_time::text, a.subject, a.body, a.active, a.updated_at,
      (select count(*) from crm.messages_outbox o where o.automation_id = a.id and o.status = 'sent')::int as sent_count,
      (select max(sent_at) from crm.messages_outbox o where o.automation_id = a.id and o.status = 'sent') as last_sent_at
    from crm.automations a
    order by array_position(array['booking_confirmed','reminder_48h','post_visit_survey','win_back']::automation_trigger[], a.trigger)`;
}

export async function getAutomation(db: Db, id: string): Promise<AutomationRow | null> {
  const rows = await listAutomations(db);
  return rows.find((a) => a.id === id) ?? null;
}

export const automationInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  channel: z.enum(["email", "sms"]),
  delay_minutes: z.coerce.number().int().min(-20160).max(20160),
  send_at_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/, "Use 24 hour time, e.g. 10:00")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().max(150).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Write the message").max(5000),
});
export type AutomationInput = z.infer<typeof automationInputSchema>;

export async function updateAutomation(db: Db, id: string, input: AutomationInput): Promise<void> {
  await db`update crm.automations set name = ${input.name}, channel = ${input.channel}, delay_minutes = ${input.delay_minutes},
    send_at_time = ${input.send_at_time || null}, subject = ${input.subject || null}, body = ${input.body} where id = ${id}`;
}

export async function setAutomationActive(db: Db, id: string, active: boolean): Promise<void> {
  await db`update crm.automations set active = ${active} where id = ${id}`;
}

export interface SimulatedSend {
  guest_id: string;
  guest_name: string;
  to: string;
  when: Date;
  subject: string | null;
  body: string;
  context: string;
}

/**
 * Works out who the automation would message right now, from the seed data,
 * without sending anything. Returns a small sample.
 */
export async function simulateAutomation(db: Db, a: AutomationRow, limit = 8): Promise<{ total: number; sample: SimulatedSend[]; explanation: string }> {
  const settings = await getParkSettings(db);
  const base = { park_name: settings.name, support_email: settings.support_email, booking_link: `${settings.website}/tickets` };
  const render = (v: MergeValues) => ({ subject: a.subject ? renderMergeFields(a.subject, v) : null, body: renderMergeFields(a.body, v) });

  type BookingCtx = {
    guest_id: string;
    guest_name: string;
    email: string;
    phone: string | null;
    first_name: string;
    last_name: string;
    reference: string;
    date: string;
    entry_time: string;
    ticket_type: string;
    group_size: number;
    booked_at: Date;
    starts_at: Date;
    email_consent: boolean;
    sms_consent: boolean;
    banned: boolean;
  };
  const bookingQuery = (where: ReturnType<Db>) => db<BookingCtx[]>`
    select g.id as guest_id, g.first_name || ' ' || g.last_name as guest_name, g.email, g.phone, g.first_name, g.last_name, g.email_consent, g.sms_consent, g.banned,
      b.reference, n.date::text as date, b.entry_time::text as entry_time, initcap(replace(b.ticket_type::text, '_', ' ')) as ticket_type, b.group_size, b.booked_at,
      (n.date::timestamp + b.entry_time) at time zone 'Europe/London' as starts_at
    from crm.bookings b join crm.guests g on g.id = b.guest_id join crm.event_nights n on n.id = b.event_night_id
    where b.status in ('confirmed', 'transferred') and ${where}`;

  const toSend = (b: BookingCtx, when: Date, context: string): SimulatedSend | null => {
    if (b.banned) return null;
    const to = a.channel === "email" ? b.email : b.phone;
    if (!to) return null;
    const v: MergeValues = {
      ...base,
      first_name: b.first_name,
      last_name: b.last_name,
      full_name: b.guest_name,
      email: b.email,
      booking_reference: b.reference,
      visit_date: b.date.split("-").reverse().join("/"),
      entry_time: b.entry_time.slice(0, 5),
      ticket_type: b.ticket_type,
      group_size: b.group_size,
      survey_link: `${settings.website}/survey/${b.reference}`,
    };
    const r = render(v);
    return { guest_id: b.guest_id, guest_name: b.guest_name, to, when, ...r, context };
  };

  switch (a.trigger) {
    case "booking_confirmed": {
      // Transactional: sent to everyone who books, regardless of marketing consent.
      const rows = await bookingQuery(db`true order by b.booked_at desc limit ${limit}`);
      const [{ count }] = await db<{ count: number }[]>`select count(*)::int as count from crm.bookings where booked_at > now() - interval '7 days'`;
      return {
        total: count,
        sample: rows.map((b) => toSend(b, new Date(b.booked_at.getTime() + a.delay_minutes * 60_000), `Booked ${b.reference}`)).filter((x): x is SimulatedSend => !!x),
        explanation: `${count} bookings were made in the last 7 days. The most recent are shown. This is a transactional message, so it goes to every booker.`,
      };
    }
    case "reminder_48h": {
      const rows = await bookingQuery(db`n.date >= current_date and n.date <= current_date + 14 order by n.date, b.entry_time limit ${limit}`);
      const [{ count }] = await db<{ count: number }[]>`
        select count(*)::int as count from crm.bookings b join crm.event_nights n on n.id = b.event_night_id
        where b.status in ('confirmed','transferred') and n.date >= current_date and n.date <= current_date + 14`;
      return {
        total: count,
        sample: rows.map((b) => toSend(b, new Date(b.starts_at.getTime() + a.delay_minutes * 60_000), `Visiting ${b.date.split("-").reverse().join("/")} at ${b.entry_time.slice(0, 5)}`)).filter((x): x is SimulatedSend => !!x),
        explanation: `${count} confirmed bookings are in the next 14 days. Each guest is messaged ${Math.abs(a.delay_minutes / 60)} hours before their entry time.`,
      };
    }
    case "post_visit_survey": {
      const rows = await bookingQuery(db`n.date < current_date and n.date >= current_date - 7 order by n.date desc, b.entry_time limit ${limit}`);
      const [{ count }] = await db<{ count: number }[]>`
        select count(*)::int as count from crm.bookings b join crm.event_nights n on n.id = b.event_night_id
        where b.status in ('confirmed','transferred') and n.date < current_date and n.date >= current_date - 7`;
      const sendTime = a.send_at_time ?? "10:00";
      return {
        total: count,
        sample: rows
          .map((b) => {
            const next = new Date(`${b.date}T${sendTime}:00`);
            next.setDate(next.getDate() + 1);
            return toSend(b, next, `Visited ${b.date.split("-").reverse().join("/")}`);
          })
          .filter((x): x is SimulatedSend => !!x),
        explanation: `${count} bookings visited in the last 7 days. Each is messaged at ${sendTime} the morning after.`,
      };
    }
    case "win_back": {
      // Marketing: uses the win back rules and respects consent.
      const [season] = await db<{ year: number }[]>`select year from crm.seasons order by year desc limit 1`;
      const rules = {
        op: "and",
        rules: [
          { type: "visited_season", season_year: (season?.year ?? new Date().getFullYear()) - 1 },
          { type: "booked_season", season_year: season?.year ?? new Date().getFullYear(), negate: true },
        ],
      };
      const recipients = await eligibleRecipients(db, rules, a.channel);
      const year = season?.year ?? new Date().getFullYear();
      const when = new Date(`${year}-09-01T10:00:00`);
      return {
        total: recipients.length,
        sample: recipients.slice(0, limit).map((r) => {
          const v = { ...base, first_name: r.first_name, last_name: r.last_name, full_name: `${r.first_name} ${r.last_name}`, email: r.email };
          return { guest_id: r.id, guest_name: `${r.first_name} ${r.last_name}`, to: a.channel === "email" ? r.email : r.phone!, when, ...render(v), context: `Visited ${year - 1}, no ${year} booking` };
        }),
        explanation: `${recipients.length} guests visited in ${year - 1}, have not booked for ${year}, and have ${a.channel === "email" ? "email" : "SMS"} consent. Guests without consent are excluded automatically.`,
      };
    }
  }
}

/** Runs the automation for real against the simulated audience, writing to the outbox. */
export async function runAutomationNow(db: Db, a: AutomationRow): Promise<number> {
  const sim = await simulateAutomation(db, a, 500);
  const settings = await getParkSettings(db);
  let n = 0;
  for (const s of sim.sample) {
    if (a.channel === "email") {
      await sendEmail(db, { guestId: s.guest_id, to: s.to, toName: s.guest_name, subject: s.subject ?? a.name, html: renderPlainEmailHtml(s.body, brandingFrom(settings)), text: s.body, automationId: a.id, status: "simulated" });
    } else {
      await sendSms(db, { guestId: s.guest_id, to: s.to, toName: s.guest_name, text: s.body, automationId: a.id, status: "simulated" });
    }
    n++;
  }
  return n;
}
