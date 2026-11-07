# Blackthorn CRM

A working demo of a guest, marketing and support platform for **Blackthorn Scream Park**, a fictional outdoor Halloween attraction near Nottingham with six walk-through scare mazes.

Built with Next.js 16 (App Router, TypeScript strict), Supabase (Postgres, Auth, row level security), Tailwind CSS v4, Recharts and Zod. It is a demonstration system: **no real emails, SMS or payments are ever sent.** Every message lands in a demo outbox and refunds are simulated behind clearly named seams (`sendEmail()`, `sendSms()`, `processRefund()`).

## What is in it

| Area | Highlights |
| --- | --- |
| Dashboard | Season KPIs, bookings per night, revenue by ticket type, survey score by maze, tickets by category, "needs attention" list |
| Guests | Server side search, filters and sorting over ~860 guests, CSV export, profile with a single timeline, consent management with timestamp and source, tags, notes, audit log |
| Segments | Visual AND/OR rule builder compiled to parameterised SQL, live count, preview, consent exclusion breakdown |
| Campaigns | Block based email editor with merge fields, desktop and mobile preview, SMS editor with segment counter, send test, send now, schedule, report with simulated engagement and bookings after |
| Automations | Booking confirmation, 48 hour reminder, post visit survey, win back. On/off, editable templates and timing, simulate |
| Outbox | Every message the system "sent", viewable as the guest would see it |
| Support | Three panel inbox, SLA timers, saved replies with merge fields, internal notes, simulated refund / move / resend / voucher actions, complaint rules, simulate inbound email, public contact form |
| Settings | Park details, staff and roles, saved replies, categories, root cause tags, SLA times |
| AI assist | Optional: triage, draft reply and thread summary via the Claude API. Hidden unless `ANTHROPIC_API_KEY` is set |

Roles are enforced by Postgres row level security, not only by the menu: the app runs every staff query inside a transaction that sets the Supabase `request.jwt.claims`, exactly as Supabase's own API does.

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine; pick the London region).
2. In **Project Settings → API** copy the project URL, the anon/publishable key and the service role key.
3. In **Project Settings → Database** copy the connection string. Use the **Transaction pooler** string (port 6543) for Vercel or Netlify; the direct string (port 5432) also works for scripts.

### 2. Configure the app

```bash
git clone https://github.com/finleymurray/blackthorn-crm.git
cd blackthorn-crm
npm install
cp .env.example .env.local
```

Fill in `.env.local`. The variables are documented in [`.env.example`](.env.example). `ANTHROPIC_API_KEY` is optional.

### 3. Create the schema and seed the demo data

```bash
npm run db:migrate   # applies supabase/migrations in order, tracked in schema_migrations
npm run db:seed      # wipes and rebuilds the demo data, identical every run
```

The seed creates two seasons, ~860 guests, ~2,000 bookings, ~520 surveys, 5 segments, 4 campaigns, 4 automations, 62 support tickets with threads, 10 saved replies, and the four demo staff accounts (as real Supabase Auth users when the service role key is set).

`npm run db:reset` drops the public schema and runs both steps.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000. The sign in page lists the demo accounts.

### 5. Deploy

**Vercel:** import the repository, add the environment variables from `.env.example`, deploy. `vercel.json` pins the London region.

**Netlify:** import the repository, add the environment variables, deploy. `netlify.toml` configures the Next.js runtime.

Use the Supabase **Transaction pooler** `DATABASE_URL` on both. No code changes are needed.

**Always-on container (fastest):** the `Dockerfile` builds a self-contained server and `fly.toml` runs it permanently in London. `/api/health` reports the database round trip time. See [docs/always-on-hosting.md](docs/always-on-hosting.md) for a free Oracle Cloud option and a low-cost Fly.io option.

### Local development without Supabase

The app can run against any Postgres 16 database. Set `DATABASE_URL` to it and `LOCAL_DEV_AUTH=1`, and the sign in page authenticates the demo accounts with `DEMO_PASSWORD` instead of Supabase Auth. `npm run db:migrate` adds a small `auth` shim so the migrations apply unchanged. This mode is refused in production builds.

## Demo logins

Password for all: `Blackthorn2026!` (or whatever `DEMO_PASSWORD` is set to when seeding).

| Name | Email | Role | Sees |
| --- | --- | --- | --- |
| Eleanor Vance | eleanor@blackthornscreampark.co.uk | Admin | Everything, including settings |
| Marcus Okafor | marcus@blackthornscreampark.co.uk | Marketing | Guests, segments, campaigns, automations, outbox |
| Priya Shah | priya@blackthornscreampark.co.uk | Support | Guests and the support inbox, including refunds |
| Tom Hardcastle | tom@blackthornscreampark.co.uk | Front desk | Guest lookup, raising tickets, moving bookings |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Lint, type check and tests |
| `npm run test` | Vitest: segment rules, consent exclusion, merge fields, SMS counting, SLA, refund maths. The database backed segment tests run when `DATABASE_URL` is set |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Reset and reseed the demo data |
| `npm run db:reset` | Drop the schema, migrate and seed |

## Where the real integrations would go

| Seam | File | Replace with |
| --- | --- | --- |
| `sendEmail()`, `sendSms()`, `sendBulk()` | `src/lib/messaging/provider.ts` | Postmark, Resend, Twilio… keep writing the outbox row for the audit trail |
| `processRefund()`, `registerVoucher()` | `src/lib/payments/provider.ts` | Stripe, Adyen or the ticketing platform |
| Inbound email → ticket | `createTicket()` in `src/lib/data/tickets.ts` | An inbound email webhook calling the same function |
| Bookings | `public.bookings` | A sync from the ticketing platform |

## Project layout

```
supabase/migrations/   SQL schema, indexes, triggers and RLS policies (rebuilds from scratch)
supabase/local/        auth shim for plain Postgres development
scripts/               migrate.ts, seed.ts and the seed data pools
src/app/(app)/         authenticated pages, one folder per area, server actions beside them
src/app/contact/       the public web form
src/lib/data/          all database access, one module per area
src/lib/segments/      rule schema, SQL compiler and consent rules
src/lib/messaging/     merge fields, email blocks, SMS counting, provider seam
src/lib/support/       SLA and refund maths
src/components/        UI primitives, shell, and feature components
```
