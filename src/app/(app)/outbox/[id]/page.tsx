import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getOutboxMessage } from "@/lib/data/outbox";
import { getParkSettings } from "@/lib/data/settings";
import { formatDateTime } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Message" };

export default async function OutboxMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("/outbox");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withStaff(staff, async (db) => {
    const message = await getOutboxMessage(db, id);
    return message ? { message, settings: await getParkSettings(db) } : null;
  });
  if (!data) notFound();
  const { message: m, settings } = data;
  const source = m.campaign_id
    ? { label: `Campaign · ${m.campaign_name}`, href: `/campaigns/${m.campaign_id}/report` }
    : m.automation_id
      ? { label: `Automation · ${m.automation_name}`, href: "/automations" }
      : m.ticket_id
        ? { label: `Ticket #${m.ticket_number}`, href: `/support/${m.ticket_id}` }
        : { label: "Manual", href: null };

  return (
    <>
      <PageHeader crumbs={[{ label: "Outbox", href: "/outbox" }]} title={m.subject ?? (m.channel === "sms" ? "Text message" : "Email")} meta={formatDateTime(m.sent_at)} />
      <PageBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {m.channel === "email" ? (
            <div className="overflow-hidden rounded-md border border-border bg-white">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-[12px] text-neutral-700">
                <div className="grid grid-cols-[60px_1fr] gap-y-1">
                  <span className="text-neutral-500">From</span>
                  <span>
                    {settings.sender_name} &lt;{settings.sender_email}&gt;
                  </span>
                  <span className="text-neutral-500">To</span>
                  <span>
                    {m.recipient_name ? `${m.recipient_name} <${m.recipient}>` : m.recipient}
                  </span>
                  <span className="text-neutral-500">Subject</span>
                  <span className="font-medium text-neutral-900">{m.subject}</span>
                </div>
              </div>
              {m.body_html ? (
                <iframe title="Email as the guest sees it" srcDoc={m.body_html} sandbox="" className="h-[720px] w-full bg-white" />
              ) : (
                <pre className="whitespace-pre-wrap p-4 font-sans text-[13px] text-neutral-900">{m.full_text}</pre>
              )}
            </div>
          ) : (
            <div className="mx-auto w-[340px] max-w-full rounded-[32px] border-[6px] border-[#2a2a31] bg-[#0b0b0e] p-4 pt-8">
              <p className="mb-4 text-center text-[11px] text-muted">{settings.sms_sender}</p>
              <div className="ml-1 mr-10 rounded-2xl rounded-bl-sm bg-[#2d2d34] px-3.5 py-2.5 text-[14px] leading-snug text-foreground">{m.full_text}</div>
              <p className="ml-2 mt-1.5 text-[10px] text-muted">Delivered {formatDateTime(m.sent_at)}</p>
            </div>
          )}
        </div>
        <aside className="space-y-3 text-xs">
          <dl className="space-y-2">
            <div>
              <dt className="text-muted">Status</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {m.status === "test" ? <Badge>Test send</Badge> : m.status === "simulated" ? <Badge variant="info">Simulated run</Badge> : <Badge dot>Delivered</Badge>}
                {m.opened_at ? (
                  <Badge variant="success" dot>
                    Opened {formatDateTime(m.opened_at)}
                  </Badge>
                ) : null}
                {m.clicked_at ? (
                  <Badge variant="info" dot>
                    Clicked {formatDateTime(m.clicked_at)}
                  </Badge>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Recipient</dt>
              <dd className="mt-0.5">
                {m.guest_id ? (
                  <Link href={`/guests/${m.guest_id}`} className="text-foreground hover:underline">
                    {m.recipient_name ?? m.recipient}
                  </Link>
                ) : (
                  m.recipient_name ?? m.recipient
                )}
                <div className="text-muted">{m.recipient}</div>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Source</dt>
              <dd className="mt-0.5">{source.href ? <Link href={source.href} className="text-foreground hover:underline">{source.label}</Link> : source.label}</dd>
            </div>
            <div>
              <dt className="text-muted">Channel</dt>
              <dd className="mt-0.5">{m.channel === "email" ? "Email" : "SMS"}</dd>
            </div>
          </dl>
          <p className="text-[11px] leading-snug text-muted">Demo outbox. This message was never delivered to a real address.</p>
        </aside>
      </PageBody>
    </>
  );
}
