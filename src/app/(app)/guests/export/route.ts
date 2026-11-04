import { getCurrentStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { guestListParamsSchema, listGuestsForExport } from "@/lib/data/guests";
import { logActivity } from "@/lib/data/activity";
import { formatDateOnly, formatPostcode } from "@/lib/format";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Guard against spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) return new Response("Unauthorised", { status: 401 });
  const url = new URL(request.url);
  const parsed = guestListParamsSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  const params = parsed.success ? parsed.data : guestListParamsSchema.parse({});

  const rows = await withStaff(staff, async (db) => {
    const rows = await listGuestsForExport(db, params);
    await logActivity(db, staff, {
      action: "guests.exported",
      entityType: "guest",
      entityId: "list",
      summary: `Exported ${rows.length} guests to CSV`,
      details: { filters: params },
    });
    return rows;
  });

  const header = ["First name", "Last name", "Email", "Phone", "Postcode", "Email consent", "SMS consent", "Tags", "Accessibility needs", "Do not touch", "Banned", "Visits", "Lifetime spend (£)", "Last visit", "Guest since"];
  const lines = [header.map(csvCell).join(",")];
  for (const g of rows) {
    lines.push(
      [
        g.first_name,
        g.last_name,
        g.email,
        g.phone,
        formatPostcode(g.postcode),
        g.email_consent ? "Yes" : "No",
        g.sms_consent ? "Yes" : "No",
        g.tags.join("; "),
        g.accessibility_needs,
        g.do_not_touch ? "Yes" : "No",
        g.banned ? "Yes" : "No",
        g.visit_count,
        (g.lifetime_spend_pence / 100).toFixed(2),
        g.last_visit_on ? formatDateOnly(g.last_visit_on) : "",
        formatDateOnly(g.created_at),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="blackthorn-guests-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
