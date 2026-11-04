import type { Db } from "@/lib/db/client";

/**
 * Message delivery.
 *
 * This is the integration seam. In the demo every message is written to
 * messages_outbox and nothing leaves the system. To go live, replace the
 * bodies of sendEmail() and sendSms() with calls to your provider (Postmark,
 * Resend, Twilio, etc.) and keep writing the outbox row for the audit trail.
 */
export interface OutgoingEmail {
  guestId: string | null;
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  campaignId?: string | null;
  automationId?: string | null;
  ticketId?: string | null;
  status?: "sent" | "test" | "simulated";
}

export interface OutgoingSms {
  guestId: string | null;
  to: string;
  toName?: string | null;
  text: string;
  campaignId?: string | null;
  automationId?: string | null;
  ticketId?: string | null;
  status?: "sent" | "test" | "simulated";
}

export async function sendEmail(db: Db, msg: OutgoingEmail): Promise<{ id: string }> {
  // Real provider call would go here. The outbox row is the demo delivery.
  const [row] = await db<{ id: string }[]>`
    insert into crm.messages_outbox (channel, guest_id, recipient_name, recipient, subject, body_html, body_text, campaign_id, automation_id, ticket_id, status)
    values ('email', ${msg.guestId}, ${msg.toName ?? null}, ${msg.to}, ${msg.subject}, ${msg.html}, ${msg.text}, ${msg.campaignId ?? null}, ${msg.automationId ?? null}, ${msg.ticketId ?? null}, ${msg.status ?? "sent"})
    returning id`;
  return row!;
}

export async function sendSms(db: Db, msg: OutgoingSms): Promise<{ id: string }> {
  const [row] = await db<{ id: string }[]>`
    insert into crm.messages_outbox (channel, guest_id, recipient_name, recipient, subject, body_html, body_text, campaign_id, automation_id, ticket_id, status)
    values ('sms', ${msg.guestId}, ${msg.toName ?? null}, ${msg.to}, null, null, ${msg.text}, ${msg.campaignId ?? null}, ${msg.automationId ?? null}, ${msg.ticketId ?? null}, ${msg.status ?? "sent"})
    returning id`;
  return row!;
}

/** Bulk insert for campaign sends: one outbox row per recipient in one statement per chunk. */
export async function sendBulk(db: Db, rows: Array<OutgoingEmail | OutgoingSms>, channel: "email" | "sms"): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((m) => ({
      channel,
      guest_id: m.guestId,
      recipient_name: m.toName ?? null,
      recipient: m.to,
      subject: "subject" in m ? m.subject : null,
      body_html: "html" in m ? m.html : null,
      body_text: m.text,
      campaign_id: m.campaignId ?? null,
      automation_id: m.automationId ?? null,
      ticket_id: m.ticketId ?? null,
      status: m.status ?? "sent",
    }));
    await db`insert into crm.messages_outbox ${db(chunk)}`;
    n += chunk.length;
  }
  return n;
}
