"use server";

import { z } from "zod";
import { withAdmin } from "@/lib/db/client";
import { createTicket, newTicketSchema } from "@/lib/data/tickets";
import { getSupportConfig } from "@/lib/data/support-config";

const publicSchema = newTicketSchema.pick({ requester_name: true, requester_email: true, subject: true, body: true, category: true, booking_reference: true }).extend({
  // Honeypot: real people leave it empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactState = { ok: true; number: number } | { ok: false; error: string; fieldErrors?: Record<string, string> } | undefined;

/** Public web form. Runs without a staff session, so it uses the service connection with strict validation. */
export async function submitContactForm(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = publicSchema.safeParse({
    requester_name: formData.get("requester_name"),
    requester_email: formData.get("requester_email"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    category: formData.get("category"),
    booking_reference: formData.get("booking_reference") ?? "",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  try {
    const t = await withAdmin(async (db) => {
      const config = await getSupportConfig(db);
      return createTicket(db, { ...parsed.data, source: "web_form" }, config.sla);
    });
    return { ok: true, number: t.number };
  } catch {
    return { ok: false, error: "Sorry, something went wrong sending your message. Please try again or email us directly." };
  }
}
