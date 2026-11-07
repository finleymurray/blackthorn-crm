"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MergeFieldMenu, insertAtCaret } from "@/components/campaigns/block-editor";
import { removeSavedReply, saveSavedReply } from "@/app/(app)/settings/actions";
import type { SavedReply } from "@/lib/data/support-config";
import { truncate } from "@/lib/utils";

export function SavedRepliesManager({ replies, categories }: { replies: SavedReply[]; categories: Array<{ key: string; label: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<SavedReply | "new" | null>(null);
  const [pending, start] = React.useTransition();
  const label = (key: string | null) => categories.find((c) => c.key === key)?.label ?? "Any category";

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> New saved reply
        </Button>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {replies.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.title}</span>
                <Badge>{label(r.category)}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">{truncate(r.body.replace(/\s+/g, " "), 160)}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${r.title}`}
                className="text-muted hover:text-danger"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Delete "${r.title}"?`)) return;
                  start(async () => {
                    const res = await removeSavedReply(r.id);
                    if (!res.ok) toast({ kind: "error", title: res.error });
                    else router.refresh();
                  });
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? <ReplyDialog reply={editing === "new" ? null : editing} categories={categories} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function ReplyDialog({ reply, categories, onClose }: { reply: SavedReply | null; categories: Array<{ key: string; label: string }>; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [body, setBody] = React.useState(reply?.body ?? "Hi {{first_name}},\n\n\n\n{{staff_name}}\nBlackthorn Guest Support");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{reply ? "Edit saved reply" : "New saved reply"}</DialogTitle>
          <DialogDescription>Keep it warm and specific. Staff can edit it before sending.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const r = await saveSavedReply(reply?.id ?? null, { title: fd.get("title"), category: fd.get("category"), body });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                toast({ kind: "error", title: r.error });
                return;
              }
              toast({ kind: "success", title: r.message ?? "Saved" });
              onClose();
              router.refresh();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sr-title" label="Title" error={errors.title} required>
              <Input id="sr-title" name="title" defaultValue={reply?.title ?? ""} />
            </Field>
            <Field id="sr-category" label="Suggested for" help="Shown first on tickets in this category.">
              <Select id="sr-category" name="category" defaultValue={reply?.category ?? ""}>
                <option value="">Any category</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="sr-body" className="text-[13px] font-medium text-muted-strong">
                Reply text <span className="text-danger">*</span>
              </label>
              <MergeFieldMenu onInsert={(t) => setBody((b) => insertAtCaret(ref.current, b, t))} />
            </div>
            <Textarea ref={ref} id="sr-body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} aria-invalid={!!errors.body} />
            {errors.body ? (
              <p role="alert" className="text-[13px] text-danger">
                {errors.body}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
