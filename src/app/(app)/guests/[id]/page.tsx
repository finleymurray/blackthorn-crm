import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cake, Mail, MapPin, Phone } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getGuest, getGuestBookings, getGuestMessages, getGuestStats, getGuestTickets, getGuestTimeline } from "@/lib/data/guests";
import { formatDate, formatDateOnly, formatMoney, formatPostcode } from "@/lib/format";
import { canEditGuests } from "@/lib/auth/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuestFlags } from "../guest-flags";
import { GuestProfileTabs } from "./profile-tabs";
import { ConsentControls, EditGuestDialog, NotesPanel, TagsEditor } from "./profile-controls";
import { initials } from "@/lib/utils";
import { CONSENT_SOURCE_LABELS } from "@/lib/domain/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Guest ${(await params).id.slice(0, 8)}` };
}

export default async function GuestProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const staff = await requireStaff("/guests");
  const { id } = await params;
  const { tab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const data = await withStaff(staff, async (db) => {
    const guest = await getGuest(db, id);
    if (!guest) return null;
    const [stats, bookings, timeline, tickets, messages] = await Promise.all([
      getGuestStats(db, id),
      getGuestBookings(db, id),
      getGuestTimeline(db, id),
      getGuestTickets(db, id),
      getGuestMessages(db, id),
    ]);
    return { guest, stats, bookings, timeline, tickets, messages };
  });
  if (!data) notFound();
  const { guest, stats } = data;
  const editable = canEditGuests(staff.role);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/guests" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden /> All guests
        </Link>
      </div>

      {/* Header */}
      <header className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold text-white" aria-hidden>
              {initials(`${guest.first_name} ${guest.last_name}`)}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {guest.first_name} {guest.last_name}
              </h1>
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-strong">
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Email</dt>
                  <Mail className="size-3.5 text-muted" aria-hidden />
                  <dd>
                    <a href={`mailto:${guest.email}`} className="hover:underline">
                      {guest.email}
                    </a>
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Phone</dt>
                  <Phone className="size-3.5 text-muted" aria-hidden />
                  <dd>{guest.phone ?? <span className="text-muted">No phone</span>}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Postcode</dt>
                  <MapPin className="size-3.5 text-muted" aria-hidden />
                  <dd>{guest.postcode ? formatPostcode(guest.postcode) : <span className="text-muted">No postcode</span>}</dd>
                </div>
                {guest.date_of_birth ? (
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">Date of birth</dt>
                    <Cake className="size-3.5 text-muted" aria-hidden />
                    <dd>{formatDateOnly(guest.date_of_birth)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-2">
                <GuestFlags guest={guest} size="md" />
              </div>
              {guest.banned && guest.banned_reason ? <p className="mt-2 text-sm text-danger">{guest.banned_reason}</p> : null}
              {guest.accessibility_needs ? <p className="mt-2 text-sm text-info">{guest.accessibility_needs}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {editable ? <EditGuestDialog guest={guest} /> : null}
            <Button asChild variant="secondary" size="sm">
              <Link href={`/support/new?guest=${guest.id}`}>New ticket</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <ConsentControls
            guestId={guest.id}
            editable={editable}
            channel="email"
            value={guest.email_consent}
            at={guest.email_consent_at ? formatDate(guest.email_consent_at) : null}
            source={guest.email_consent_source ? CONSENT_SOURCE_LABELS[guest.email_consent_source] ?? guest.email_consent_source : null}
          />
          <ConsentControls
            guestId={guest.id}
            editable={editable}
            channel="sms"
            value={guest.sms_consent}
            at={guest.sms_consent_at ? formatDate(guest.sms_consent_at) : null}
            source={guest.sms_consent_source ? CONSENT_SOURCE_LABELS[guest.sms_consent_source] ?? guest.sms_consent_source : null}
          />
        </div>
      </header>

      {/* Stats */}
      <section aria-label="Key stats" className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Stat label="Visits" value={String(guest.visit_count)} sub={guest.first_visit_on ? `since ${formatDateOnly(guest.first_visit_on)}` : "never visited"} />
        <Stat label="Lifetime spend" value={formatMoney(guest.lifetime_spend_pence)} sub={`${stats.total_bookings} booking${stats.total_bookings === 1 ? "" : "s"}`} />
        <Stat label="Favourite maze" value={stats.favourite_maze ?? "–"} sub={`${stats.mazes_completed} mazes survived`} />
        <Stat
          label="Chickened out of"
          value={stats.chickened_out_of.length ? stats.chickened_out_of.join(", ") : "Nothing"}
          sub={stats.chickened_out_of.length ? "at least once" : "braver than most"}
          small={stats.chickened_out_of.length > 1}
        />
        <Stat label="Survey average" value={stats.avg_survey_score ? `${stats.avg_survey_score.toFixed(1)} / 10` : "–"} sub={stats.open_tickets ? `${stats.open_tickets} open ticket${stats.open_tickets === 1 ? "" : "s"}` : "no open tickets"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <GuestProfileTabs guestId={guest.id} initialTab={tab} bookings={data.bookings} timeline={data.timeline} tickets={data.tickets} messages={data.messages} />
        </div>
        <aside className="space-y-4">
          <TagsEditor guestId={guest.id} tags={guest.tags} editable={editable} />
          <NotesPanel guestId={guest.id} notes={guest.notes} editable={editable} />
          <div className="rounded-lg border border-border bg-surface p-4 text-xs text-muted">
            <p>
              Guest since {formatDate(guest.created_at)}. Last updated {formatDate(guest.updated_at)}.
            </p>
            <p className="mt-1">
              Staff changes are recorded in the activity log and shown in the timeline. <Badge variant="outline" className="ml-1">GDPR</Badge>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, small }: { label: string; value: string; sub: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1.5 font-semibold ${small ? "text-sm leading-snug" : "text-lg"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}
