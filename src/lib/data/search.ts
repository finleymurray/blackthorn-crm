import type { Db } from "@/lib/db/client";
import type { SearchHit } from "@/components/shell/command-palette";

export async function globalSearch(db: Db, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
  const compact = q.replace(/\s+/g, "").toUpperCase();
  const refCandidate = compact.startsWith("BTH-") ? compact : compact.startsWith("BTH") ? "BTH-" + compact.slice(3) : "BTH-" + compact;
  const ticketNumber = /^#?(\d{1,6})$/.exec(q.trim())?.[1];

  const [guests, bookings, tickets] = await Promise.all([
    db<{ id: string; first_name: string; last_name: string; email: string; postcode: string | null }[]>`
      select id, first_name, last_name, email, postcode from crm.guests
      where (first_name || ' ' || last_name) ilike ${like} or email ilike ${like}
        or replace(coalesce(phone, ''), ' ', '') like ${"%" + compact + "%"}
        or upper(replace(coalesce(postcode, ''), ' ', '')) like ${compact + "%"}
      order by last_visit_on desc nulls last limit 6`,
    db<{ id: string; reference: string; guest_id: string; name: string; date: string; status: string }[]>`
      select b.id, b.reference, b.guest_id, g.first_name || ' ' || g.last_name as name, n.date::text, b.status::text
      from crm.bookings b join crm.guests g on g.id = b.guest_id join crm.event_nights n on n.id = b.event_night_id
      where upper(b.reference) like ${refCandidate + "%"} limit 4`,
    db<{ id: string; number: number; subject: string; requester_name: string; status: string }[]>`
      select id, number, subject, requester_name, status::text from crm.tickets
      where subject ilike ${like} or requester_name ilike ${like} or requester_email ilike ${like}
        ${ticketNumber ? db`or number = ${Number(ticketNumber)}` : db``}
      order by created_at desc limit 5`,
  ]);

  return [
    ...guests.map((g) => ({
      type: "guest" as const,
      id: g.id,
      title: `${g.first_name} ${g.last_name}`,
      subtitle: [g.email, g.postcode].filter(Boolean).join(" · "),
      href: `/guests/${g.id}`,
    })),
    ...bookings.map((b) => ({
      type: "booking" as const,
      id: b.id,
      title: b.reference,
      subtitle: `${b.name} · ${b.date.split("-").reverse().join("/")} · ${b.status}`,
      href: `/guests/${b.guest_id}?tab=bookings`,
    })),
    ...tickets.map((t) => ({
      type: "ticket" as const,
      id: t.id,
      title: `#${t.number} ${t.subject}`,
      subtitle: `${t.requester_name} · ${t.status.replace(/_/g, " ")}`,
      href: `/support/${t.id}`,
    })),
  ];
}
