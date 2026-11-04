import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listTags } from "@/lib/data/guests";
import { getSegment } from "@/lib/data/segments";
import { SegmentEditor } from "@/components/segments/segment-editor";
import { canManageMarketing } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Segment" };

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("/segments");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withStaff(staff, async (db) => {
    const segment = await getSegment(db, id);
    if (!segment) return null;
    return {
      segment,
      lookups: {
        seasons: (await db<{ year: number }[]>`select year from public.seasons order by year desc`).map((s) => s.year),
        tags: await listTags(db),
      },
    };
  });
  if (!data) notFound();
  return (
    <SegmentEditor
      segment={{ id: data.segment.id, name: data.segment.name, description: data.segment.description ?? "", campaign_count: data.segment.campaign_count }}
      initialRules={data.segment.rules}
      lookups={data.lookups}
      readOnly={!canManageMarketing(staff.role)}
    />
  );
}
