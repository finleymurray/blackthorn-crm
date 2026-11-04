import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getGuest, getGuestBookings, getGuestMessages, getGuestStats, getGuestTickets, getGuestTimeline } from "@/lib/data/guests";
import { formatDate, formatDateOnly, formatMoney, formatPostcode } from "@/lib/format";
import { canEditGuests } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { GuestFlags } from "../guest-flags";
import { GuestProfileTabs } from "./profile-tabs";
import { ConsentControls, EditGuestDialog, NotesPanel, TagsEditor } from "./profile-controls";
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
    <div className="space-y-5">
      <Link href="/guests" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
        <ArrowLeft className="size-3" aria-hidden /> Guests
      </Link>

      <header className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {guest.first_name} {guest.last_name}
            </h1>
            <GuestFlags guest={guest} size="md" />
          </div>
          <dl className="kv mt-3 max-w-xl">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${guest.email}`} className="hover:underline">
                {guest.email}
              </a>
            </dd>
            <dt>Phone</dt>
            <dd>{guest.phone ?? <span className="text-muted">Not recorded</span>}</dd>
            <dt>Postcode</dt>
            <dd>{guest.postcode ? formatPostcode(guest.postcode) : <span className="text-muted">Not recorded</span>}</dd>
            <dt>Date of birth</dt>
            <dd>{guest.date_of_birth ? formatDateOnly(guest.date_of_birth) : <span className="text-muted">Not recorded</span>}</dd>
            {guest.accessibility_needs ? (
              <>
                <dt>Accessibility</dt>
                <dd className="text-info">{guest.accessibility_needs}</dd>
              </>
            ) : null}
            {guest.banned ? (
              <>
                <dt>Ban</dt>
                <dd className="text-danger">{guest.banned_reason ?? "Banned from the park"}</dd>
              </>
            ) : null}
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {editable ? <EditGuestDialog guest={guest} /> : null}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/support/new?guest=${guest.id}`}>New ticket</Link>
          </Button>
        </div>
      </header>

      <section aria-label="Marketing consent" className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
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
      </section>

      <section aria-label="Key stats" className="stat-strip grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="stat-label">Visits</p>
          <p className="stat-value">{guest.visit_count}</p>
          <p className="stat-sub">{guest.first_visit_on ? `first ${formatDateOnly(guest.first_visit_on)}` : "never visited"}</p>
        </div>
        <div>
          <p className="stat-label">Lifetime spend</p>
          <p className="stat-value">{formatMoney(guest.lifetime_spend_pence)}</p>
          <p className="stat-sub">
            {stats.total_bookings} booking{stats.total_bookings === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="stat-label">Survey average</p>
          <p className="stat-value">{stats.avg_survey_score ? `${stats.avg_survey_score.toFixed(1)}` : "–"}</p>
          <p className="stat-sub">
            {stats.surveys_completed} survey{stats.surveys_completed === 1 ? "" : "s"} completed
          </p>
        </div>
        <div>
          <p className="stat-label">Support</p>
          <p className="stat-value">{stats.open_tickets}</p>
          <p className="stat-sub">open · {stats.resolved_tickets} resolved</p>
        </div>
        <div>
          <p className="stat-label">Messages sent</p>
          <p className="stat-value">{stats.messages_sent}</p>
          <p className="stat-sub">{stats.last_booking_at ? `last booked ${formatDate(stats.last_booking_at)}` : "never booked"}</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <GuestProfileTabs guestId={guest.id} initialTab={tab} bookings={data.bookings} timeline={data.timeline} tickets={data.tickets} messages={data.messages} />
        </div>
        <aside className="space-y-4">
          <TagsEditor guestId={guest.id} tags={guest.tags} editable={editable} />
          <NotesPanel guestId={guest.id} notes={guest.notes} editable={editable} />
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            Record created {formatDate(guest.created_at)}, last updated {formatDate(guest.updated_at)}. Staff changes are written to the activity log and appear in the timeline.
          </p>
        </aside>
      </div>
    </div>
  );
}
