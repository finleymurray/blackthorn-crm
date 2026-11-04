import type { Db } from "@/lib/db/client";

export interface DashboardKpis {
  total_guests: number;
  bookings_this_season: number;
  revenue_this_season_pence: number;
  repeat_guest_pct: number;
  open_tickets: number;
  overdue_tickets: number;
  avg_survey_score: number | null;
  season_name: string;
  season_year: number;
}

export interface NightPoint {
  date: string;
  bookings: number;
  people: number;
  capacity: number;
}
export interface TicketTypeRevenue {
  ticket_type: string;
  revenue_pence: number;
  bookings: number;
}
export interface MazeScore {
  maze: string;
  slug: string;
  avg_score: number;
  responses: number;
  chicken_out_pct: number;
}
export interface CategoryCount {
  category: string;
  label: string;
  total: number;
  open: number;
}
export interface AttentionItem {
  kind: "overdue" | "complaint" | "low_survey";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  at: Date;
  severity: "danger" | "warning";
}

export async function getCurrentSeason(db: Db) {
  const rows = await db<{ id: string; year: number; name: string }[]>`
    select id, year, name from public.seasons order by is_current desc, year desc limit 1`;
  return rows[0] ?? null;
}

export async function getDashboardKpis(db: Db): Promise<DashboardKpis> {
  const season = await getCurrentSeason(db);
  const seasonId = season?.id ?? null;
  const [row] = await db<
    {
      total_guests: number;
      bookings_this_season: number;
      revenue_this_season_pence: number;
      repeat_guest_pct: number;
      open_tickets: number;
      overdue_tickets: number;
      avg_survey_score: number | null;
    }[]
  >`
    select
      (select count(*) from public.guests)::int as total_guests,
      (select count(*) from public.bookings b join public.event_nights n on n.id = b.event_night_id
         where n.season_id = ${seasonId} and b.status <> 'refunded')::int as bookings_this_season,
      (select coalesce(sum(b.total_paid_pence - b.refunded_pence), 0) from public.bookings b join public.event_nights n on n.id = b.event_night_id
         where n.season_id = ${seasonId} and b.status <> 'refunded')::int as revenue_this_season_pence,
      (select case when count(*) filter (where visit_count >= 1) = 0 then 0
         else round(100.0 * count(*) filter (where visit_count >= 2) / count(*) filter (where visit_count >= 1), 1) end
         from public.guests)::float as repeat_guest_pct,
      (select count(*) from public.tickets where status <> 'resolved')::int as open_tickets,
      (select count(*) from public.tickets where status <> 'resolved' and sla_due_at < now())::int as overdue_tickets,
      (select round(avg(s.overall_score)::numeric, 2) from public.surveys s join public.bookings b on b.id = s.booking_id
         join public.event_nights n on n.id = b.event_night_id where n.season_id = ${seasonId})::float as avg_survey_score`;
  return { ...row, season_name: season?.name ?? "No season", season_year: season?.year ?? 0 };
}

export async function getBookingsPerNight(db: Db): Promise<NightPoint[]> {
  const season = await getCurrentSeason(db);
  return db<NightPoint[]>`
    select n.date::text as date, count(b.id)::int as bookings, coalesce(sum(b.group_size), 0)::int as people, n.capacity
    from public.event_nights n
    left join public.bookings b on b.event_night_id = n.id and b.status <> 'refunded'
    where n.season_id = ${season?.id ?? null} and n.status <> 'cancelled'
    group by n.id order by n.date`;
}

export async function getRevenueByTicketType(db: Db): Promise<TicketTypeRevenue[]> {
  const season = await getCurrentSeason(db);
  return db<TicketTypeRevenue[]>`
    select b.ticket_type::text as ticket_type, sum(b.total_paid_pence - b.refunded_pence)::int as revenue_pence, count(*)::int as bookings
    from public.bookings b join public.event_nights n on n.id = b.event_night_id
    where n.season_id = ${season?.id ?? null} and b.status <> 'refunded'
    group by b.ticket_type order by revenue_pence desc`;
}

export async function getSurveyScoreByMaze(db: Db): Promise<MazeScore[]> {
  return db<MazeScore[]>`
    with scores as (
      select key as slug, (value::text)::numeric as score
      from public.surveys s, jsonb_each(s.maze_scores)
    ),
    visits as (
      select maze_id, count(*) as total, count(*) filter (where chickened_out) as chickened from public.maze_visits group by maze_id
    )
    select m.name as maze, m.slug, round(avg(sc.score), 2)::float as avg_score, count(sc.score)::int as responses,
      coalesce(round(100.0 * v.chickened / nullif(v.total, 0), 1), 0)::float as chicken_out_pct
    from public.mazes m
    left join scores sc on sc.slug = m.slug
    left join visits v on v.maze_id = m.id
    group by m.id, v.chickened, v.total order by m.sort_order`;
}

export async function getTicketsByCategory(db: Db): Promise<CategoryCount[]> {
  return db<CategoryCount[]>`
    select c.key as category, c.label, count(t.id)::int as total, count(t.id) filter (where t.status <> 'resolved')::int as open
    from public.ticket_categories c
    left join public.tickets t on t.category = c.key
    group by c.key, c.label, c.sort_order order by c.sort_order`;
}

export async function getNeedsAttention(db: Db): Promise<AttentionItem[]> {
  const overdue = await db<{ id: string; number: number; subject: string; requester_name: string; sla_due_at: Date; priority: string }[]>`
    select id, number, subject, requester_name, sla_due_at, priority::text as priority from public.tickets
    where status <> 'resolved' and sla_due_at < now() order by sla_due_at asc limit 5`;
  const complaints = await db<{ id: string; number: number; subject: string; requester_name: string; created_at: Date }[]>`
    select id, number, subject, requester_name, created_at from public.tickets
    where status <> 'resolved' and category = 'complaint' and sla_due_at >= now() order by created_at desc limit 4`;
  let lowSurveys = await db<{ id: string; guest_id: string; guest_name: string; overall_score: number; comments: string | null; submitted_at: Date }[]>`
    select s.id, s.guest_id, g.first_name || ' ' || g.last_name as guest_name, s.overall_score, s.comments, s.submitted_at
    from public.surveys s join public.guests g on g.id = s.guest_id
    where s.overall_score <= 4 and s.submitted_at > now() - interval '7 days' order by s.submitted_at desc limit 5`;
  if (lowSurveys.length === 0) {
    // Outside the season: show the most recent low scores so the list is still useful.
    lowSurveys = await db<typeof lowSurveys>`
      select s.id, s.guest_id, g.first_name || ' ' || g.last_name as guest_name, s.overall_score, s.comments, s.submitted_at
      from public.surveys s join public.guests g on g.id = s.guest_id
      where s.overall_score <= 4 order by s.submitted_at desc limit 3`;
  }

  const items: AttentionItem[] = [
    ...overdue.map((t) => ({
      kind: "overdue" as const,
      id: t.id,
      title: `#${t.number} ${t.subject}`,
      subtitle: `${t.requester_name} · SLA overdue`,
      href: `/support/${t.id}`,
      at: t.sla_due_at,
      severity: "danger" as const,
    })),
    ...complaints.map((t) => ({
      kind: "complaint" as const,
      id: t.id,
      title: `#${t.number} ${t.subject}`,
      subtitle: `${t.requester_name} · open complaint`,
      href: `/support/${t.id}`,
      at: t.created_at,
      severity: "warning" as const,
    })),
    ...lowSurveys.map((s) => ({
      kind: "low_survey" as const,
      id: s.id,
      title: `${s.overall_score}/10 from ${s.guest_name}`,
      subtitle: s.comments ?? "No comment left",
      href: `/guests/${s.guest_id}`,
      at: s.submitted_at,
      severity: "warning" as const,
    })),
  ];
  return items;
}
