import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { audienceSummary, countSegment, previewSegment } from "@/lib/data/segments";
import { ruleGroupSchema } from "@/lib/segments/types";

const bodySchema = z.object({ rules: ruleGroupSchema });

/** Live count, consent breakdown and a 20 guest preview for the segment builder. */
export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid rules" }, { status: 400 });
  const { rules } = parsed.data;
  try {
    const data = await withStaff(staff, async (db) => {
      const [count, preview, email, sms] = await Promise.all([
        countSegment(db, rules),
        previewSegment(db, rules, 20),
        audienceSummary(db, rules, "email"),
        audienceSummary(db, rules, "sms"),
      ]);
      return { count, preview, email, sms };
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not evaluate the segment" }, { status: 500 });
  }
}
