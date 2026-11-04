import type { Metadata } from "next";
import Link from "next/link";
import { Filter, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { countSegment, listSegments } from "@/lib/data/segments";
import { countRules, describeGroup } from "@/lib/segments/compile";
import { formatDate, formatNumber } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Segments" };

export default async function SegmentsPage() {
  const staff = await requireStaff("/segments");
  const segments = await withStaff(staff, async (db) => {
    const rows = await listSegments(db);
    const counts = await Promise.all(rows.map((s) => countSegment(db, s.rules).catch(() => null)));
    return rows.map((s, i) => ({ ...s, count: counts[i] }));
  });

  return (
    <>
      <PageHeader
        title="Segments"
        meta={`${segments.length} saved`}
        actions={
          <Button asChild size="sm">
            <Link href="/segments/new">
              <Plus /> New segment
            </Link>
          </Button>
        }
      />
      <PageBody wide>
        {segments.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No segments yet"
            description="Segments are saved sets of rules, like “visited in 2025 but not booked for 2026”. Campaigns send to a segment."
            action={
              <Button asChild size="sm">
                <Link href="/segments/new">Create the first segment</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="hidden md:table-cell">Rules</TableHead>
                <TableHead className="text-right">Guests</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Campaigns</TableHead>
                <TableHead className="hidden lg:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/segments/${s.id}`} className="font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                      {s.name}
                    </Link>
                    {s.description ? <div className="text-xs text-muted">{s.description}</div> : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted">
                    <span className="text-muted-strong">{countRules(s.rules)} rule{countRules(s.rules) === 1 ? "" : "s"}</span> · {truncate(describeGroup(s.rules), 90)}
                  </TableCell>
                  <TableCell className="tabular text-right">{s.count === null ? <span className="text-danger">Error</span> : formatNumber(s.count)}</TableCell>
                  <TableCell className="hidden sm:table-cell tabular text-right text-muted-strong">{s.campaign_count}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-strong">
                    {formatDate(s.updated_at)}
                    {s.created_by_name ? <span className="text-muted"> · {s.created_by_name}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
