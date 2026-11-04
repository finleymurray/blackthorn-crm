"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createTicketAction } from "@/app/(app)/support/actions";

export function NewTicketForm({ categories, prefill }: { categories: Array<{ key: string; label: string }>; prefill: { name: string; email: string; reference: string | null } | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await createTicketAction({
            requester_name: fd.get("requester_name"),
            requester_email: fd.get("requester_email"),
            subject: fd.get("subject"),
            body: fd.get("body"),
            category: fd.get("category"),
            booking_reference: fd.get("booking_reference") ?? "",
            source: "email",
            priority: fd.get("priority") || undefined,
          });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.error);
            return;
          }
          router.push(`/support/${(r.data as { id: string }).id}`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="nt-name" label="Guest name" error={errors.requester_name} required>
          <Input id="nt-name" name="requester_name" defaultValue={prefill?.name ?? ""} aria-invalid={!!errors.requester_name} />
        </Field>
        <Field id="nt-email" label="Guest email" error={errors.requester_email} required help="Used to match the guest record.">
          <Input id="nt-email" name="requester_email" type="email" defaultValue={prefill?.email ?? ""} aria-invalid={!!errors.requester_email} />
        </Field>
        <Field id="nt-category" label="Category" error={errors.category} required>
          <Select id="nt-category" name="category" defaultValue="general">
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="nt-priority" label="Priority" help="Leave blank to use the category default.">
          <Select id="nt-priority" name="priority" defaultValue="">
            <option value="">Category default</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <Field id="nt-ref" label="Booking reference" error={errors.booking_reference} help="Optional, e.g. BTH-7K2Q">
          <Input id="nt-ref" name="booking_reference" defaultValue={prefill?.reference ?? ""} className="uppercase" />
        </Field>
        <Field id="nt-subject" label="Subject" error={errors.subject} required className="sm:col-span-2">
          <Input id="nt-subject" name="subject" aria-invalid={!!errors.subject} />
        </Field>
        <Field id="nt-body" label="What the guest told us" error={errors.body} required className="sm:col-span-2">
          <Textarea id="nt-body" name="body" rows={6} aria-invalid={!!errors.body} />
        </Field>
      </div>
      {formError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {formError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/support")}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Create ticket
        </Button>
      </div>
    </form>
  );
}
