import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { guestListParamsSchema, listGuests, listTags, type GuestListParams } from "@/lib/data/guests";
import { formatDateOnly, formatMoney, formatNumber, formatPostcode } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { GuestFilters } from "./guest-filters";
import { GuestFlags } from "./guest-flags";

export const metadata: Metadata = { title: "Guests" };

type Search = Record<string, string | string[] | undefined>;

function toQuery(p: GuestListParams, overrides: Partial<GuestListParams> = {}): string {
  const merged = { ...p, ...overrides };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.sort !== "last_visit") sp.set("sort", merged.sort);
  if (merged.dir !== "desc") sp.set("dir", merged.dir);
  if (merged.page > 1) sp.set("page", String(merged.page));
  if (merged.per !== 25) sp.set("per", String(merged.per));
  if (merged.email_consent !== "any") sp.set("email_consent", merged.email_consent);
  if (merged.sms_consent !== "any") sp.set("sms_consent", merged.sms_consent);
  if (merged.flag !== "any") sp.set("flag", merged.flag);
  if (merged.tag) sp.set("tag", merged.tag);
  if (merged.season) sp.set("season", String(merged.season));
  if (merged.min_visits !== undefined) sp.set("min_visits", String(merged.min_visits));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function GuestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const staff = await requireStaff("/guests");
  const raw = await searchParams;
  const parsed = guestListParamsSchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const params: GuestListParams = parsed.success ? parsed.data : guestListParamsSchema.parse({});

  const { rows, total, tags, seasons } = await withStaff(staff, async (db) => {
    const [list, tags, seasons] = await Promise.all([
      listGuests(db, params),
      listTags(db),
      db<{ year: number }[]>`select year from public.seasons order by year desc`,
    ]);
    return { ...list, tags, seasons: seasons.map((s) => s.year) };
  });

  const sortLink = (key: GuestListParams["sort"], label: string, align: "left" | "right" = "left") => {
    const active = params.sort === key;
    const nextDir = active && params.dir === "desc" ? "asc" : "desc";
    const Icon = active ? (params.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <Link
        href={`/guests${toQuery(params, { sort: key, dir: active ? nextDir : key === "name" ? "asc" : "desc", page: 1 })}`}
        className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon className="size-3" aria-hidden />
        <span className="sr-only">{active ? `, sorted ${params.dir === "asc" ? "ascending" : "descending"}` : ", click to sort"}</span>
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Guests"
        description={`${formatNumber(total)} ${total === 1 ? "guest matches" : "guests match"} the current filters.`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={`/guests/export${toQuery(params, { page: 1 })}`} download>
              <Download /> Export CSV
            </a>
          </Button>
        }
      />

      <GuestFilters params={params} tags={tags} seasons={seasons} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guests match"
          description="Try a broader search, or clear the filters. Searches cover name, email, phone, postcode and booking reference."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/guests">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead aria-sort={params.sort === "name" ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>{sortLink("name", "Guest")}</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Postcode</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead className="text-right" aria-sort={params.sort === "visits" ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {sortLink("visits", "Visits", "right")}
                </TableHead>
                <TableHead className="text-right" aria-sort={params.sort === "spend" ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {sortLink("spend", "Spend", "right")}
                </TableHead>
                <TableHead className="hidden sm:table-cell" aria-sort={params.sort === "last_visit" ? (params.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {sortLink("last_visit", "Last visit")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Link href={`/guests/${g.id}`} className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                      {g.first_name} {g.last_name}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted md:hidden">{g.email}</div>
                    <GuestFlags guest={g} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">{g.email}</div>
                    <div className="text-xs text-muted">{g.phone ?? "No phone"}</div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">{formatPostcode(g.postcode)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant={g.email_consent ? "success" : "default"} aria-label={`Email consent ${g.email_consent ? "given" : "not given"}`}>
                        Email
                      </Badge>
                      <Badge variant={g.sms_consent ? "success" : "default"} aria-label={`SMS consent ${g.sms_consent ? "given" : "not given"}`}>
                        SMS
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right">{g.visit_count}</TableCell>
                  <TableCell className="tabular text-right">{formatMoney(g.lifetime_spend_pence)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-strong">{g.last_visit_on ? formatDateOnly(g.last_visit_on) : "Never"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={params.page} per={params.per} total={total} makeHref={(p) => `/guests${toQuery(params, { page: p })}`} />
        </>
      )}
    </div>
  );
}
