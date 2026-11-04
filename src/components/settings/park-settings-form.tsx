"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveParkSettings } from "@/app/(app)/settings/actions";
import type { ParkSettings } from "@/lib/data/settings";
import { ThornMark } from "@/components/brand/logo";

export function ParkSettingsForm({ settings }: { settings: ParkSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [logo, setLogo] = React.useState(settings.logo_url ?? "");

  return (
    <form
      className="panel space-y-4 p-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveParkSettings(Object.fromEntries(fd.entries()));
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            toast({ kind: "error", title: r.error });
            return;
          }
          setErrors({});
          toast({ kind: "success", title: r.message ?? "Saved" });
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ps-name" label="Park name" error={errors.name} required>
          <Input id="ps-name" name="name" defaultValue={settings.name} />
        </Field>
        <Field id="ps-tagline" label="Tagline" error={errors.tagline}>
          <Input id="ps-tagline" name="tagline" defaultValue={settings.tagline} />
        </Field>
        <Field id="ps-logo" label="Logo URL" error={errors.logo_url} help="Optional. Shown in email headers when set." className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <Input id="ps-logo" name="logo_url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" />
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/[0.06]" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="" className="size-9 object-contain" /> : <ThornMark className="size-5" />}
            </span>
          </div>
        </Field>
        <Field id="ps-sender-name" label="Sender name" error={errors.sender_name} required help="The 'from' name on emails.">
          <Input id="ps-sender-name" name="sender_name" defaultValue={settings.sender_name} />
        </Field>
        <Field id="ps-sender-email" label="Sender email" error={errors.sender_email} required>
          <Input id="ps-sender-email" name="sender_email" type="email" defaultValue={settings.sender_email} />
        </Field>
        <Field id="ps-support-email" label="Support email" error={errors.support_email} required help="Shown on the contact form and in {{support_email}}.">
          <Input id="ps-support-email" name="support_email" type="email" defaultValue={settings.support_email} />
        </Field>
        <Field id="ps-sms" label="SMS sender ID" error={errors.sms_sender} required help="2 to 11 letters or numbers, as networks require.">
          <Input id="ps-sms" name="sms_sender" defaultValue={settings.sms_sender} maxLength={11} />
        </Field>
        <Field id="ps-website" label="Website" error={errors.website} required>
          <Input id="ps-website" name="website" defaultValue={settings.website} />
        </Field>
        <Field id="ps-address" label="Postal address" error={errors.address} help="Printed in email footers (required for marketing email).">
          <Input id="ps-address" name="address" defaultValue={settings.address} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save park details
        </Button>
      </div>
    </form>
  );
}
