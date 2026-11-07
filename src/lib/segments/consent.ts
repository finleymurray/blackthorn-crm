/**
 * Marketing consent rules. A guest is only ever sent a campaign when they
 * have given consent for that channel, are not banned, and we have an
 * address to send to. The SQL in audience.ts mirrors these rules exactly
 * and the unit tests check both agree.
 */
export type Channel = "email" | "sms";

export type ExclusionReason = "banned" | "no_email_consent" | "no_sms_consent" | "no_phone" | "no_email";

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  banned: "Banned from the park",
  no_email_consent: "No email marketing consent",
  no_sms_consent: "No SMS marketing consent",
  no_phone: "No phone number on file",
  no_email: "No email address on file",
};

export interface ConsentFacts {
  banned: boolean;
  email_consent: boolean;
  sms_consent: boolean;
  email: string | null;
  phone: string | null;
}

/** Returns why a guest must be excluded from a send, or null when they can receive it. */
export function exclusionReason(guest: ConsentFacts, channel: Channel): ExclusionReason | null {
  if (guest.banned) return "banned";
  if (channel === "email") {
    if (!guest.email_consent) return "no_email_consent";
    if (!guest.email || !guest.email.trim()) return "no_email";
    return null;
  }
  if (!guest.sms_consent) return "no_sms_consent";
  if (!guest.phone || !guest.phone.trim()) return "no_phone";
  return null;
}

/** SQL CASE expression producing the same reason, for aggregate counts. */
export function exclusionReasonSql(channel: Channel, alias = "g"): string {
  if (channel === "email") {
    return `case when ${alias}.banned then 'banned'
      when not ${alias}.email_consent then 'no_email_consent'
      when coalesce(trim(${alias}.email), '') = '' then 'no_email'
      else null end`;
  }
  return `case when ${alias}.banned then 'banned'
    when not ${alias}.sms_consent then 'no_sms_consent'
    when coalesce(trim(${alias}.phone), '') = '' then 'no_phone'
    else null end`;
}

export interface AudienceSummary {
  total: number;
  eligible: number;
  excluded: number;
  reasons: Partial<Record<ExclusionReason, number>>;
}

export function summarise(guests: ConsentFacts[], channel: Channel): AudienceSummary {
  const reasons: Partial<Record<ExclusionReason, number>> = {};
  let eligible = 0;
  for (const g of guests) {
    const r = exclusionReason(g, channel);
    if (r) reasons[r] = (reasons[r] ?? 0) + 1;
    else eligible++;
  }
  return { total: guests.length, eligible, excluded: guests.length - eligible, reasons };
}
