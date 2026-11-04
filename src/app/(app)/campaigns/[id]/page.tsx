import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getCampaign } from "@/lib/data/campaigns";
import { listSegments } from "@/lib/data/segments";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { canManageMarketing } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("/campaigns");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withStaff(staff, async (db) => {
    const campaign = await getCampaign(db, id);
    if (!campaign) return null;
    const segments = (await listSegments(db)).map((s) => ({ id: s.id, name: s.name }));
    return { campaign, segments };
  });
  if (!data) notFound();
  if (data.campaign.status === "sent") redirect(`/campaigns/${id}/report`);
  return <CampaignEditor campaign={data.campaign} segments={data.segments} readOnly={!canManageMarketing(staff.role)} />;
}
