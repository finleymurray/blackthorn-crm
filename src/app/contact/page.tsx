import type { Metadata } from "next";
import { ThornMark } from "@/components/brand/logo";
import { adminSql } from "@/lib/db/client";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

/** The public web form, as a guest would see it on the park's website. Creates a support ticket. */
export default async function ContactPage() {
  const categories = await adminSql<{ key: string; label: string }[]>`select key, label from crm.ticket_categories where active order by sort_order`.catch(() => []);
  const [settings] = await adminSql<{ name: string; support_email: string }[]>`select name, support_email from crm.park_settings where id = 1`.catch(() => [{ name: "Blackthorn Scream Park", support_email: "support@example.com" }]);

  return (
    <main className="vignette min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <ThornMark className="size-8 text-foreground" />
          <div>
            <p className="font-display text-2xl leading-none tracking-wide">{settings?.name ?? "Blackthorn"}</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Guest support</p>
          </div>
        </div>
        <h1 className="text-xl font-medium">How can we help?</h1>
        <p className="mt-1 text-[13px] text-muted">
          Tell us what&apos;s happened and we&apos;ll come back to you by email, usually within a day. For anything urgent on an event night, speak to a member of staff at the box office.
        </p>
        <div className="panel mt-6 p-5">
          <ContactForm categories={categories} />
        </div>
        <p className="mt-6 text-center text-[11px] text-muted">
          Or email {settings?.support_email}. This is a demonstration form: messages create tickets in the Blackthorn CRM and are not sent anywhere else.
        </p>
      </div>
    </main>
  );
}
