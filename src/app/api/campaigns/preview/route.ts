import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { audienceSummary } from "@/lib/data/segments";
import { getParkSettings, brandingFrom } from "@/lib/data/settings";
import { SAMPLE_VALUES } from "@/lib/data/campaigns";
import { emailBlocksSchema, renderBlocksToHtml } from "@/lib/messaging/email-blocks";

const bodySchema = z.object({
  blocks: emailBlocksSchema.optional(),
  segment_id: z.string().uuid().nullable().optional(),
  channel: z.enum(["email", "sms"]).optional(),
});

/** Renders the email HTML for the live preview and returns the audience summary for the chosen segment. */
export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { blocks, segment_id, channel } = parsed.data;
  const data = await withStaff(staff, async (db) => {
    const settings = await getParkSettings(db);
    const html = blocks ? renderBlocksToHtml(blocks, { ...SAMPLE_VALUES, park_name: settings.name, support_email: settings.support_email }, brandingFrom(settings)) : null;
    let audience = null;
    if (segment_id && channel) {
      const [seg] = await db<{ rules: unknown }[]>`select rules from public.segments where id = ${segment_id}`;
      if (seg) audience = await audienceSummary(db, seg.rules, channel);
    }
    return { html, audience, smsSender: settings.sms_sender };
  });
  return NextResponse.json(data);
}
