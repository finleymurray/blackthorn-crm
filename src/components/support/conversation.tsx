"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Mail, MessageSquareText, Send, Sparkles, StickyNote, UserRound, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogTrigger, SheetContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fillSavedReply, replyToTicket } from "@/app/(app)/support/actions";
import type { GuestContext, TicketDetail, TicketMessage } from "@/lib/data/tickets";
import type { StaffUser } from "@/lib/auth/types";
import { formatDateTime } from "@/lib/format";
import { TicketFields, type FieldConfig } from "./ticket-fields";
import { SlaTimer } from "./sla-timer";
import { ContextPanel } from "./context-panel";
import { AiAssist } from "./ai-assist";
import { cn, titleCase } from "@/lib/utils";

export function Conversation({
  ticket,
  messages,
  config,
  context,
  staff,
  editable,
  canReply,
  ai,
}: {
  ticket: TicketDetail;
  messages: TicketMessage[];
  config: FieldConfig & { savedReplies: Array<{ id: string; title: string; category: string | null }> };
  context: GuestContext;
  staff: StaffUser;
  editable: boolean;
  canReply: boolean;
  ai: boolean;
}) {
  const [contextOpen, setContextOpen] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-16 shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <Button asChild variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back to tickets">
          <Link href="/support">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">
            <span className="text-muted">#{ticket.number}</span> {ticket.subject}
          </h1>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {ticket.requester_name} · {ticket.requester_email} · via {ticket.source === "web_form" ? "web form" : "email"} · opened {formatDateTime(ticket.created_at)}
          </p>
        </div>
        <div className="hidden w-44 shrink-0 sm:block">
          <SlaTimer dueAt={ticket.sla_due_at} createdAt={ticket.created_at} resolvedAt={ticket.resolved_at} />
        </div>
        <Dialog open={contextOpen} onOpenChange={setContextOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Show guest details">
              <PanelRight />
            </Button>
          </DialogTrigger>
          <SheetContent side="right" aria-describedby={undefined} className="w-[min(22rem,92vw)] overflow-y-auto bg-surface">
            <DialogTitle className="sr-only">Guest details</DialogTitle>
            <ContextPanel ticket={ticket} context={context} canAct={canReply} canRefund={editable} />
          </SheetContent>
        </Dialog>
      </header>

      <TicketFields ticket={ticket} config={config} editable={editable} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <ol className="mx-auto max-w-3xl space-y-7">
          {messages.map((m) => (
            <li key={m.id} className={cn("flex gap-3", m.direction === "outbound" && "flex-row-reverse")}>
              <Avatar name={m.author_name} size="sm" className="mt-1" />
              <div className={cn("min-w-0 max-w-[85%]", m.direction === "outbound" && "text-right")}>
                <div className={cn("mb-1.5 flex items-center gap-2 text-xs text-muted", m.direction === "outbound" && "justify-end")}>
                  <span className="font-medium text-muted-strong">{m.author_name}</span>
                  {m.direction === "internal_note" ? (
                    <Badge variant="warning">
                      <Lock className="size-2.5" aria-hidden /> Internal note
                    </Badge>
                  ) : m.direction === "outbound" ? (
                    <Badge variant="info">
                      <Mail className="size-2.5" aria-hidden /> Sent to guest
                    </Badge>
                  ) : (
                    <Badge>
                      <UserRound className="size-2.5" aria-hidden /> Guest
                    </Badge>
                  )}
                  <time dateTime={new Date(m.sent_at).toISOString()}>{formatDateTime(m.sent_at)}</time>
                </div>
                <div
                  className={cn(
                    "inline-block whitespace-pre-wrap rounded-lg px-4 py-3 text-left text-sm leading-relaxed",
                    m.direction === "internal_note"
                      ? "border border-warning/30 bg-warning-soft/60 text-foreground"
                      : m.direction === "outbound"
                        ? "bg-accent-soft text-foreground"
                        : "bg-white/[0.05] text-foreground",
                  )}
                >
                  {m.body}
                </div>
              </div>
            </li>
          ))}
          <div ref={endRef} />
        </ol>
      </div>

      {canReply ? <Composer ticket={ticket} savedReplies={config.savedReplies} ai={ai} staffName={staff.name} /> : null}
    </div>
  );
}

function Composer({ ticket, savedReplies, ai, staffName }: { ticket: TicketDetail; savedReplies: Array<{ id: string; title: string; category: string | null }>; ai: boolean; staffName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = React.useState<"reply" | "note">("reply");
  const [body, setBody] = React.useState("");
  const [setStatus, setSetStatus] = React.useState<"" | "open" | "waiting_on_guest" | "resolved">("");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const relevant = [...savedReplies].sort((a, b) => Number(b.category === ticket.category) - Number(a.category === ticket.category));

  const submit = () =>
    start(async () => {
      const r = await replyToTicket(ticket.id, { body, kind, set_status: setStatus });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setBody("");
      setSetStatus("");
      toast({ kind: "success", title: r.message ?? "Done" });
      router.refresh();
    });

  return (
    <div className="shrink-0 border-t border-border bg-surface px-6 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-md bg-white/[0.04] p-0.5" role="radiogroup" aria-label="Message type">
            <button
              type="button"
              role="radio"
              aria-checked={kind === "reply"}
              onClick={() => setKind("reply")}
              className={cn("inline-flex h-6 items-center gap-1 rounded-[4px] px-2 text-xs", kind === "reply" ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground")}
            >
              <MessageSquareText className="size-3" aria-hidden /> Reply to guest
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === "note"}
              onClick={() => setKind("note")}
              className={cn("inline-flex h-6 items-center gap-1 rounded-[4px] px-2 text-xs", kind === "note" ? "bg-warning-soft text-warning" : "text-muted hover:text-foreground")}
            >
              <StickyNote className="size-3" aria-hidden /> Internal note
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                Saved replies
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
              <DropdownMenuLabel>Merge fields are filled in for this ticket</DropdownMenuLabel>
              {relevant.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onSelect={() =>
                    start(async () => {
                      const res = await fillSavedReply(ticket.id, r.id);
                      if (!res.ok) {
                        toast({ kind: "error", title: "Could not load reply", description: res.error });
                        return;
                      }
                      setKind("reply");
                      setBody((res.data as { text: string }).text);
                      ref.current?.focus();
                    })
                  }
                >
                  <span className="flex-1">{r.title}</span>
                  {r.category === ticket.category ? <Badge variant="accent">Match</Badge> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {ai ? <AiAssist ticketId={ticket.id} onDraft={(text) => { setKind("reply"); setBody(text); ref.current?.focus(); }} /> : null}
        </div>
        <label htmlFor="composer" className="sr-only">
          {kind === "reply" ? "Reply to guest" : "Internal note"}
        </label>
        <Textarea
          ref={ref}
          id="composer"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={kind === "note" ? 3 : 5}
          placeholder={kind === "reply" ? `Write to ${ticket.requester_name.split(" ")[0]}… Use a saved reply to start quickly.` : "Add a note for colleagues. The guest never sees this."}
          className={cn(kind === "note" && "border-warning/40 bg-warning-soft/30")}
          aria-invalid={!!error}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) submit();
          }}
        />
        {error ? (
          <p role="alert" className="mt-1 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {kind === "reply" ? (
              <>
                Sends as {staffName.split(" ")[0]} to {ticket.requester_email} (demo outbox). <kbd className="rounded-[3px] bg-white/[0.06] px-1">Ctrl</kbd>+<kbd className="rounded-[3px] bg-white/[0.06] px-1">Enter</kbd> to send.
              </>
            ) : (
              "Internal notes are only visible to staff."
            )}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="composer-status" className="sr-only">
              Status after sending
            </label>
            <Select id="composer-status" value={setStatus} onChange={(e) => setSetStatus(e.target.value as typeof setStatus)} className="h-8 w-auto text-[13px]">
              <option value="">Keep status: {titleCase(ticket.status)}</option>
              <option value="open">and mark Open</option>
              <option value="waiting_on_guest">and mark Waiting on guest</option>
              <option value="resolved">and mark Resolved</option>
            </Select>
            <Button type="button" size="sm" onClick={submit} loading={pending} disabled={!body.trim()} variant={kind === "note" ? "secondary" : "default"}>
              {kind === "reply" ? (
                <>
                  <Send /> Send reply
                </>
              ) : (
                <>
                  <StickyNote /> Add note
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      {ai ? null : <span className="sr-only"><Sparkles className="size-3" aria-hidden /></span>}
    </div>
  );
}
