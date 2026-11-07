import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getGuest, getGuestBookings, getGuestMessages, getGuestStats, getGuestTickets, getGuestTimeline } from "@/lib/data/guests";
import { formatDate, formatDateOnly, formatMoney, formatPostcode } from "@/lib/format";
import { canEditGuests } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PageBody, PageHeader } from "@/components/ui/page-header";
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
  const name = `${guest.first_name} ${guest.last_name}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Guests", href: "/guests" }]}
        title={name}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/support/new?guest=${guest.id}`}>New ticket</Link>
            </Button>
            {editable ? <EditGuestDialog guest={guest} /> : null}
          </>
        }
      />
      <PageBody wide className="p-0 sm:p-0">
        <div className="grid min-h-full xl:grid-cols-[360px_1fr]">
          {/* Record pane */}
          <aside className="border-b border-border xl:border-b-0 xl:border-r">
            <div className="flex items-start gap-4 px-6 pb-6 pt-7">
              <Avatar name={name} size="lg" />
              <div className="min-w-0">
                <h2 className="text-base font-medium">{name}</h2>
                <p className="text-[13px] text-muted">Guest since {formatDate(guest.created_at)}</p>
                <div className="mt-2">
                  <GuestFlags guest={guest} size="md" />
                </div>
              </div>
            </div>

            <section className="px-6 py-5 hairline-b">
              <dl>
                <div className="attr">
                  <dt>Email</dt>
                  <dd className="truncate">
                    <a href={`mailto:${guest.email}`} className="hover:underline">
                      {guest.email}
                    </a>
                  </dd>
                </div>
                <div className="attr">
                  <dt>Phone</dt>
                  <dd>{guest.phone ?? <span className="text-muted">Empty</span>}</dd>
                </div>
                <div className="attr">
                  <dt>Postcode</dt>
                  <dd>{guest.postcode ? formatPostcode(guest.postcode) : <span className="text-muted">Empty</span>}</dd>
                </div>
                <div className="attr">
                  <dt>Date of birth</dt>
                  <dd>{guest.date_of_birth ? formatDateOnly(guest.date_of_birth) : <span className="text-muted">Empty</span>}</dd>
                </div>
                <div className="attr">
                  <dt>Accessibility</dt>
                  <dd className={guest.accessibility_needs ? "text-info" : "text-muted"}>{guest.accessibility_needs ?? "None recorded"}</dd>
                </div>
                {guest.banned ? (
                  <div className="attr">
                    <dt>Ban</dt>
                    <dd className="text-danger">{guest.banned_reason ?? "Banned from the park"}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="px-6 py-5 hairline-b" aria-label="Marketing consent">
              <h3 className="mb-2 text-xs font-medium text-muted">Marketing consent</h3>
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

            <section className="px-6 py-5 hairline-b">
              <TagsEditor guestId={guest.id} tags={guest.tags} editable={editable} />
            </section>
            <section className="px-6 py-5">
              <NotesPanel guestId={guest.id} notes={guest.notes} editable={editable} />
            </section>
          </aside>

          {/* Activity */}
          <div className="min-w-0 space-y-8 p-6 sm:p-8">
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
                  {stats.surveys_completed} survey{stats.surveys_completed === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="stat-label">Open tickets</p>
                <p className="stat-value">{stats.open_tickets}</p>
                <p className="stat-sub">{stats.resolved_tickets} resolved</p>
              </div>
              <div>
                <p className="stat-label">Messages sent</p>
                <p className="stat-value">{stats.messages_sent}</p>
                <p className="stat-sub">{stats.last_booking_at ? `last booked ${formatDate(stats.last_booking_at)}` : "never booked"}</p>
              </div>
            </section>
            <div>
              <GuestProfileTabs guestId={guest.id} initialTab={tab} bookings={data.bookings} timeline={data.timeline} tickets={data.tickets} messages={data.messages} />
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
