"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { submitContactForm, type ContactState } from "./actions";

export function ContactForm({ categories }: { categories: Array<{ key: string; label: string }> }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContactForm, undefined);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
        <h2 className="mt-3 text-[15px] font-medium">Thanks, we&apos;ve got it</h2>
        <p className="mt-1 max-w-sm text-[13px] text-muted">
          Your reference is <span className="font-medium text-foreground">#{state.number}</span>. We&apos;ll reply by email. If you need to add anything, just reply to the confirmation.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cf-name" label="Your name" error={errors.requester_name} required>
          <Input id="cf-name" name="requester_name" autoComplete="name" aria-invalid={!!errors.requester_name} />
        </Field>
        <Field id="cf-email" label="Email address" error={errors.requester_email} required>
          <Input id="cf-email" name="requester_email" type="email" autoComplete="email" aria-invalid={!!errors.requester_email} />
        </Field>
        <Field id="cf-category" label="What is it about?" error={errors.category} required>
          <Select id="cf-category" name="category" defaultValue="general">
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="cf-ref" label="Booking reference" error={errors.booking_reference} help="On your confirmation email, e.g. BTH-7K2Q">
          <Input id="cf-ref" name="booking_reference" className="uppercase" />
        </Field>
        <Field id="cf-subject" label="Subject" error={errors.subject} required className="sm:col-span-2">
          <Input id="cf-subject" name="subject" aria-invalid={!!errors.subject} />
        </Field>
        <Field id="cf-body" label="Message" error={errors.body} required className="sm:col-span-2">
          <Textarea id="cf-body" name="body" rows={6} aria-invalid={!!errors.body} />
        </Field>
      </div>
      <div className="hidden" aria-hidden>
        <label htmlFor="cf-website">Website</label>
        <input id="cf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" loading={pending}>
        Send message
      </Button>
    </form>
  );
}
