import type { Db } from "@/lib/db/client";
import type { EmailBranding } from "@/lib/messaging/email-blocks";

export interface ParkSettings {
  name: string;
  tagline: string;
  logo_url: string | null;
  sender_name: string;
  sender_email: string;
  support_email: string;
  sms_sender: string;
  address: string;
  website: string;
  timezone: string;
}

export async function getParkSettings(db: Db): Promise<ParkSettings> {
  const [row] = await db<ParkSettings[]>`
    select name, tagline, logo_url, sender_name, sender_email, support_email, sms_sender, address, website, timezone
    from public.park_settings where id = 1`;
  return row!;
}

export function brandingFrom(s: ParkSettings): EmailBranding {
  return { parkName: s.name, website: s.website, address: s.address, logoUrl: s.logo_url };
}
