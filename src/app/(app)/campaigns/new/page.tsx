import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listSegments } from "@/lib/data/segments";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ channel?: string }> }) {
  const staff = await requireRole("admin", "marketing");
  const { channel } = await searchParams;
  const segments = await withStaff(staff, async (db) => (await listSegments(db)).map((s) => ({ id: s.id, name: s.name })));
  return <CampaignEditor campaign={null} segments={segments} defaultChannel={channel === "sms" ? "sms" : "email"} />;
}
