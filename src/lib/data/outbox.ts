import { z } from "zod";
import type { Db } from "@/lib/db/client";

export const outboxParamsSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  channel: z.enum(["any", "email", "sms"]).optional().default("any"),
  source: z.enum(["any", "campaign", "automation", "ticket", "test"]).optional().default("any"),
  page: z.coerce.number().int().min(1).optional().default(1),
  per: z.coerce.number().int().min(10).max(100).optional().default(30),
});
export type OutboxParams = z.infer<typeof outboxParamsSchema>;

export interface OutboxRow {
  id: string;
  channel: "email" | "sms";
  guest_id: string | null;
  recipient_name: string | null;
  recipient: string;
  subject: string | null;
  body_text: string;
  status: "sent" | "test" | "simulated";
  sent_at: Date;
  opened_at: Date | null;
  clicked_at: Date | null;
  campaign_id: string | null;
  campaign_name: string | null;
  automation_id: string | null;
  automation_name: string | null;
  ticket_id: string | null;
  ticket_number: number | null;
}

export async function listOutbox(db: Db, p: OutboxParams): Promise<{ rows: OutboxRow[]; total: number }> {
  const conds = [];
  if (p.q) {
    const like = `%${p.q.replace(/[%_]/g, (m) => "\\" + m)}%`;
    conds.push(db`(o.recipient ilike ${like} or coalesce(o.recipient_name, '') ilike ${like} or coalesce(o.subject, '') ilike ${like})`);
  }
  if (p.channel !== "any") conds.push(db`o.channel = ${p.channel}::message_channel`);
  if (p.source === "campaign") conds.push(db`o.campaign_id is not null and o.status = 'sent'`);
  if (p.source === "automation") conds.push(db`o.automation_id is not null`);
  if (p.source === "ticket") conds.push(db`o.ticket_id is not null`);
  if (p.source === "test") conds.push(db`o.status = 'test'`);
  const where = conds.length ? conds.reduce((a, c) => db`${a} and ${c}`) : db`true`;
  const offset = (p.page - 1) * p.per;
  const [rows, [{ count }]] = await Promise.all([
    db<OutboxRow[]>`
      select o.id, o.channel::text as channel, o.guest_id, o.recipient_name, o.recipient, o.subject, left(o.body_text, 160) as body_text, o.status::text as status,
        o.sent_at, o.opened_at, o.clicked_at, o.campaign_id, c.name as campaign_name, o.automation_id, a.name as automation_name, o.ticket_id, t.number as ticket_number
      from crm.messages_outbox o
      left join crm.campaigns c on c.id = o.campaign_id
      left join crm.automations a on a.id = o.automation_id
      left join crm.tickets t on t.id = o.ticket_id
      where ${where}
      order by o.sent_at desc, o.id limit ${p.per} offset ${offset}`,
    db<{ count: number }[]>`select count(*)::int as count from crm.messages_outbox o where ${where}`,
  ]);
  return { rows, total: count };
}

export interface OutboxMessage extends OutboxRow {
  body_html: string | null;
  full_text: string;
}

export async function getOutboxMessage(db: Db, id: string): Promise<OutboxMessage | null> {
  const rows = await db<OutboxMessage[]>`
    select o.id, o.channel::text as channel, o.guest_id, o.recipient_name, o.recipient, o.subject, o.body_text as full_text, left(o.body_text, 160) as body_text, o.body_html,
      o.status::text as status, o.sent_at, o.opened_at, o.clicked_at, o.campaign_id, c.name as campaign_name, o.automation_id, a.name as automation_name, o.ticket_id, t.number as ticket_number
    from crm.messages_outbox o
    left join crm.campaigns c on c.id = o.campaign_id
    left join crm.automations a on a.id = o.automation_id
    left join crm.tickets t on t.id = o.ticket_id
    where o.id = ${id}`;
  return rows[0] ?? null;
}

export async function outboxCounts(db: Db): Promise<{ total: number; today: number; email: number; sms: number }> {
  const [row] = await db<{ total: number; today: number; email: number; sms: number }[]>`
    select count(*)::int as total,
      count(*) filter (where sent_at > now() - interval '24 hours')::int as today,
      count(*) filter (where channel = 'email')::int as email,
      count(*) filter (where channel = 'sms')::int as sms
    from crm.messages_outbox`;
  return row!;
}
