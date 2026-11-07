"use server";

import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getGuestContext, getTicket, getTicketMessages, ticketMergeValues } from "@/lib/data/tickets";
import { getSupportConfig } from "@/lib/data/support-config";
import { aiEnabled, askClaude, extractJson } from "@/lib/ai/claude";
import { logActivity } from "@/lib/data/activity";
import { errorMessage } from "@/lib/utils";
import type { SupportResult } from "./actions";

const SYSTEM = `You are a support assistant for Blackthorn Scream Park, a UK outdoor Halloween scare attraction near Nottingham with six walk-through mazes. Use UK English spelling, a warm but professional tone, dates as DD/MM/YYYY, and GBP. Never invent policies, refunds or facts that are not in the context. Nothing you write is sent automatically: a staff member reviews it.`;

async function threadText(ticketId: string, staffId: string) {
  const staff = await requireStaff();
  void staffId;
  return withStaff(staff, async (db) => {
    const ticket = await getTicket(db, ticketId);
    if (!ticket) throw new Error("Ticket not found");
    const [messages, context, config] = await Promise.all([getTicketMessages(db, ticketId), getGuestContext(db, ticket), getSupportConfig(db)]);
    const values = await ticketMergeValues(db, ticket, staff);
    const thread = messages.map((m) => `[${m.direction === "inbound" ? "GUEST" : m.direction === "outbound" ? "STAFF" : "INTERNAL NOTE"} ${m.author_name}]\n${m.body}`).join("\n\n");
    const guest = context.guest
      ? `Guest: ${context.guest.first_name} ${context.guest.last_name}, ${context.guest.visit_count} visits, lifetime spend £${(context.guest.lifetime_spend_pence / 100).toFixed(2)}${context.guest.accessibility_needs ? `, accessibility: ${context.guest.accessibility_needs}` : ""}${context.guest.banned ? ", BANNED" : ""}.`
      : "Guest: not matched to a record.";
    const bookings = context.bookings
      .slice(0, 4)
      .map((b) => `${b.reference} on ${b.date.split("-").reverse().join("/")} at ${b.entry_time.slice(0, 5)}, ${b.group_size} x ${b.ticket_type}, paid £${(b.total_paid_pence / 100).toFixed(2)}, status ${b.status}`)
      .join("; ");
    const replies = config.savedReplies.map((r) => `- ${r.title}: ${r.body.replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
    return { ticket, thread, guest, bookings, replies, values, config, staff };
  });
}

export async function aiDraftReply(ticketId: string): Promise<SupportResult> {
  if (!aiEnabled()) return { ok: false, error: "AI assist is not configured." };
  try {
    const t = await threadText(ticketId, "");
    const prompt = `Ticket #${t.ticket.number}: "${t.ticket.subject}" (category ${t.ticket.category}, priority ${t.ticket.priority}).
${t.guest}
Bookings: ${t.bookings || "none"}.

Conversation so far:
${t.thread}

House style examples (saved replies, with {{merge_fields}}):
${t.replies}

Write the next reply from ${t.values.staff_name} to the guest. Plain text, no subject line, sign off with the staff first name and "Blackthorn Guest Support". Be specific to their situation. If a decision (refund, move) is needed that staff must make, phrase it as what we can offer rather than promising it. Keep it under 180 words.`;
    const text = await askClaude(SYSTEM, prompt, 600);
    const staff = await requireStaff();
    await withStaff(staff, (db) => logActivity(db, staff, { action: "ticket.ai_draft", entityType: "ticket", entityId: ticketId, summary: `Generated an AI draft reply for #${t.ticket.number}` }));
    return { ok: true, data: { text } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function aiSummarise(ticketId: string): Promise<SupportResult> {
  if (!aiEnabled()) return { ok: false, error: "AI assist is not configured." };
  try {
    const t = await threadText(ticketId, "");
    const prompt = `Summarise this support thread for a colleague picking it up. Use 3 to 6 short bullet points: what the guest wants, what has been done, what is outstanding, and any risk (safety, complaint, press). Then one line: "Suggested next step: ...".

Ticket #${t.ticket.number}: "${t.ticket.subject}" (${t.ticket.category}, ${t.ticket.priority}, status ${t.ticket.status}).
${t.guest}
Bookings: ${t.bookings || "none"}.

${t.thread}`;
    const text = await askClaude(SYSTEM, prompt, 500);
    return { ok: true, data: { text } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function aiTriage(ticketId: string): Promise<SupportResult> {
  if (!aiEnabled()) return { ok: false, error: "AI assist is not configured." };
  try {
    const t = await threadText(ticketId, "");
    const categories = t.config.categories.map((c) => c.key).join(", ");
    const prompt = `Classify this support ticket. Reply with JSON only: {"category": one of [${categories}], "priority": one of [low, normal, high, urgent], "reason": one sentence}.
Rules: safety incidents, injuries, allegations about staff or actors, and anything legal are urgent. Complaints are high. Refunds and booking changes for a visit within 48 hours are high. Lost property is low.

Subject: ${t.ticket.subject}
${t.thread.slice(0, 3000)}`;
    const text = await askClaude(SYSTEM, prompt, 200);
    const parsed = extractJson<{ category: string; priority: string; reason: string }>(text);
    if (!parsed || !t.config.categories.some((c) => c.key === parsed.category) || !["low", "normal", "high", "urgent"].includes(parsed.priority)) {
      return { ok: false, error: "The AI reply could not be understood. Try again." };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
