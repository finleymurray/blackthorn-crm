import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Ticket } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { bookingListParamsSchema, listBookings, listNights, type BookingListParams } from "@/lib/data/bookings";
import { formatClock, formatDateOnly, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { BookingFilters } from "@/components/bookings/booking-filters";
import { BOOKING_STATUS_LABELS, TICKET_TYPE_LABELS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

const tone: Record<string, "success" | "danger" | "info" | "warning"> = { confirmed: "success", refunded: "danger", transferred: "info", no_show: "warning" };

export function bookingQuery(p: BookingListParams, overrides: Partial<BookingListParams> = {}) {
  const m = { ...p, ...overrides };
  const sp = new URLSearchParams();
  if (m.q) sp.set("q", m.q);
  if (m.status !== "all") sp.set("status", m.status);
  if (m.ticket_type) sp.set("ticket_type", m.ticket_type);
  if (m.night) sp.set("night", m.night);
  if (m.season) sp.set("season", String(m.season));
  if (m.when !== "all") sp.set("when", m.when);
  if (m.sort !== "night") sp.set("sort", m.sort);
  if (m.dir !== "desc") sp.set("dir", m.dir);
  if (m.page > 1) sp.set("page", String(m.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await requireStaff("/bookings");
  const raw = await searchParams;
  const parsed = bookingListParamsSchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const params = parsed.success ? parsed.data : bookingListParamsSchema.parse({});
  const { rows, total, revenue_pence, nights } = await withStaff(staff, async (db) => ({ ...(await listBookings(db, params)), nights: await listNights(db) }));

  const ariaSort = (k: BookingListParams["sort"]): "ascending" | "descending" | "none" => (params.sort === k ? (params.dir === "asc" ? "ascending" : "descending") : "none");
  const sortLink = (key: BookingListParams["sort"], label: string, right = false) => {
    const active = params.sort === key;
    const Icon = params.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <Link href={`/bookings${bookingQuery(params, { sort: key, dir: active && params.dir === "desc" ? "asc" : "desc", page: 1 })}`} className={cn("group inline-flex items-center gap-1 hover:text-foreground", right && "flex-row-reverse", active && "text-foreground")}>
        {label}
        <Icon className={cn("size-3", active ? "opacity-100" : "opacity-0 group-hover:opacity-50")} aria-hidden />
      </Link>
    );
  };

  return (
    <>
      <PageHeader title="Bookings" meta={`${formatNumber(total)} ${total === 1 ? "booking" : "bookings"} · ${formatMoney(revenue_pence)} net`} />
      <PageBody wide className="space-y-5">
        <BookingFilters params={params} nights={nights} />
        {rows.length === 0 ? (
          <EmptyState icon={Ticket} title="No bookings match" description="Try a different night, status or search. References look like BTH-7K2Q." action={<Button asChild variant="secondary" size="sm"><Link href="/bookings">Clear filters</Link></Button>} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead aria-sort={ariaSort("guest")}>{sortLink("guest", "Guest")}</TableHead>
                  <TableHead aria-sort={ariaSort("night")}>{sortLink("night", "Night")}</TableHead>
                  <TableHead className="hidden md:table-cell">Tickets</TableHead>
                  <TableHead className="hidden lg:table-cell">Add-ons</TableHead>
                  <TableHead className="text-right" aria-sort={ariaSort("paid")}>{sortLink("paid", "Paid", true)}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell" aria-sort={ariaSort("booked")}>{sortLink("booked", "Booked")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/bookings/${b.id}`} className="whitespace-nowrap font-mono text-[13px] font-medium hover:underline">
                        {b.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={b.guest_name} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/guests/${b.guest_id}`} className="hover:underline">{b.guest_name}</Link>
                          <div className="truncate text-xs text-muted">{b.guest_email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular">
                      {formatDateOnly(b.date)} <span className="text-muted">{formatClock(b.entry_time)}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {b.group_size} × {TICKET_TYPE_LABELS[b.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? b.ticket_type}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-[13px] text-muted">{b.addons.length ? b.addons.map((a) => a.replace("_", " ")).join(", ") : "–"}</TableCell>
                    <TableCell className="tabular text-right">
                      {formatMoney(b.total_paid_pence)}
                      {b.refunded_pence ? <div className="text-xs text-danger">−{formatMoney(b.refunded_pence)}</div> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tone[b.status]} dot>{BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap xl:table-cell tabular text-muted-strong">{formatDateTime(b.booked_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={params.page} per={params.per} total={total} makeHref={(p) => `/bookings${bookingQuery(params, { page: p })}`} />
          </>
        )}
      </PageBody>
    </>
  );
}
