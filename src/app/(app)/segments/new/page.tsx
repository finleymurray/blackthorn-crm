import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listTags } from "@/lib/data/guests";
import { SegmentEditor } from "@/components/segments/segment-editor";
import { EMPTY_GROUP } from "@/lib/segments/types";

export const metadata: Metadata = { title: "New segment" };

export default async function NewSegmentPage() {
  const staff = await requireRole("admin", "marketing");
  const lookups = await withStaff(staff, async (db) => ({
    seasons: (await db<{ year: number }[]>`select year from public.seasons order by year desc`).map((s) => s.year),
    tags: await listTags(db),
  }));
  return <SegmentEditor segment={null} initialRules={EMPTY_GROUP} lookups={lookups} />;
}
