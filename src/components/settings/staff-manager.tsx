"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { addStaff, changeStaff } from "@/app/(app)/settings/actions";
import type { StaffRow } from "@/lib/data/admin";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/auth/types";
import { formatDateTime, formatRelative } from "@/lib/format";

export function StaffManager({ rows, currentId, authConfigured }: { rows: StaffRow[]; currentId: string; authConfigured: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const change = (id: string, patch: { role?: StaffRole; active?: boolean }) =>
    start(async () => {
      const r = await changeStaff(id, patch);
      if (!r.ok) toast({ kind: "error", title: "Not changed", description: r.error });
      else router.refresh();
    });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Add staff member
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Activity</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id} className={!s.active ? "opacity-60" : undefined}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.name} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {s.id === currentId ? <Badge>You</Badge> : null}
                    </div>
                    <div className="truncate text-[13px] text-muted">{s.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <label htmlFor={`role-${s.id}`} className="sr-only">
                  Role for {s.name}
                </label>
                <Select id={`role-${s.id}`} value={s.role} disabled={pending} onChange={(e) => change(s.id, { role: e.target.value as StaffRole })} className="h-7 w-auto text-[13px]">
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </TableCell>
              <TableCell className="hidden md:table-cell text-[13px] text-muted-strong">
                {s.actions_30d} action{s.actions_30d === 1 ? "" : "s"} in 30 days
                {s.last_action_at ? <span className="text-muted"> · last {formatRelative(s.last_action_at)}</span> : null}
                <div className="text-xs text-muted">Added {formatDateTime(s.created_at)}</div>
              </TableCell>
              <TableCell>
                <Switch aria-label={`${s.name} active`} checked={s.active} disabled={pending || s.id === currentId} onCheckedChange={(v) => change(s.id, { active: v })} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              {authConfigured ? "A sign in is created with the demo password, which they should change." : "Creates the staff record. Without Supabase Auth configured, local development sign in uses the demo password."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const r = await addStaff(Object.fromEntries(fd.entries()));
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  toast({ kind: "error", title: r.error });
                  return;
                }
                setErrors({});
                setOpen(false);
                toast({ kind: "success", title: r.message ?? "Added" });
                router.refresh();
              });
            }}
          >
            <Field id="st-name" label="Name" error={errors.name} required>
              <Input id="st-name" name="name" />
            </Field>
            <Field id="st-email" label="Email" error={errors.email} required>
              <Input id="st-email" name="email" type="email" />
            </Field>
            <Field id="st-role" label="Role" error={errors.role} required>
              <Select id="st-role" name="role" defaultValue="support">
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
