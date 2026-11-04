-- ===========================================================================
-- Blackthorn Scream Park CRM: core schema
-- Rebuilds the whole database from scratch. Money is stored in pence.
-- All timestamps are timestamptz; the app renders them in Europe/London.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type staff_role as enum ('admin', 'marketing', 'support', 'front_desk');
create type consent_source as enum ('booking', 'web_form', 'staff', 'import', 'competition', 'unsubscribe_link');
create type event_night_status as enum ('on_sale', 'sold_out', 'cancelled');
create type ticket_type as enum ('standard', 'fast_track', 'vip', 'group');
create type booking_status as enum ('confirmed', 'refunded', 'transferred', 'no_show');
create type message_channel as enum ('email', 'sms');
create type campaign_status as enum ('draft', 'scheduled', 'sent');
create type automation_trigger as enum ('booking_confirmed', 'reminder_48h', 'post_visit_survey', 'win_back');
create type outbox_status as enum ('sent', 'test', 'simulated');
create type ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type ticket_status as enum ('new', 'open', 'waiting_on_guest', 'resolved');
create type ticket_source as enum ('email', 'web_form');
create type message_direction as enum ('inbound', 'outbound', 'internal_note');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create table public.staff_users (
  id uuid primary key,                         -- matches auth.users.id
  name text not null,
  email text not null unique,
  role staff_role not null default 'support',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_users_role_idx on public.staff_users (role);

-- The role of the signed in staff member. Used by every RLS policy.
create or replace function public.current_staff_role()
returns staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff_users where id = auth.uid() and active;
$$;

create or replace function public.is_staff()
returns boolean language sql stable as $$
  select public.current_staff_role() is not null;
$$;

create or replace function public.has_role(variadic roles staff_role[])
returns boolean language sql stable as $$
  select public.current_staff_role() = any (roles);
$$;

-- ---------------------------------------------------------------------------
-- Park settings and reference data
-- ---------------------------------------------------------------------------
create table public.park_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'Blackthorn Scream Park',
  tagline text not null default 'Nottingham''s darkest night out',
  logo_url text,
  sender_name text not null default 'Blackthorn Scream Park',
  sender_email text not null default 'hello@blackthornscreampark.co.uk',
  support_email text not null default 'support@blackthornscreampark.co.uk',
  sms_sender text not null default 'Blackthorn',
  address text not null default 'Blackthorn Farm, Oxton Road, Nottingham NG25 0RA',
  website text not null default 'https://blackthornscreampark.co.uk',
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.park_settings (id) values (1);

create table public.ticket_categories (
  key text primary key,
  label text not null,
  default_priority ticket_priority not null default 'normal',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.root_cause_tags (
  key text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hours allowed to first response / resolution per priority.
create table public.sla_policies (
  priority ticket_priority primary key,
  hours integer not null check (hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mazes, seasons, nights
-- ---------------------------------------------------------------------------
create table public.mazes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  min_age integer not null default 12,
  is_extreme boolean not null default false,  -- the 18+ "touch" maze
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_nights (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  date date not null unique,
  opens_at time not null default '18:00',
  closes_at time not null default '23:00',
  capacity integer not null check (capacity > 0),
  status event_night_status not null default 'on_sale',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_nights_season_idx on public.event_nights (season_id, date);

create table public.ticket_products (
  key ticket_type primary key,
  name text not null,
  price_pence integer not null check (price_pence >= 0),
  description text not null default ''
);

create table public.addons (
  key text primary key,
  name text not null,
  price_pence integer not null check (price_pence >= 0)
);

-- ---------------------------------------------------------------------------
-- Guests
-- ---------------------------------------------------------------------------
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  postcode text,
  date_of_birth date,
  email_consent boolean not null default false,
  email_consent_at timestamptz,
  email_consent_source consent_source,
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  sms_consent_source consent_source,
  tags text[] not null default '{}',
  accessibility_needs text,                   -- free text, null when none
  do_not_touch boolean not null default false, -- opt out of contact in Nightfall Manor
  banned boolean not null default false,
  banned_reason text,
  notes text,
  lifetime_spend_pence integer not null default 0,
  visit_count integer not null default 0,
  first_visit_on date,
  last_visit_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_last_name_idx on public.guests (lower(last_name), lower(first_name));
create index guests_email_idx on public.guests (lower(email));
create index guests_phone_idx on public.guests (phone);
create index guests_postcode_idx on public.guests (upper(replace(postcode, ' ', '')));
create index guests_tags_idx on public.guests using gin (tags);
create index guests_last_visit_idx on public.guests (last_visit_on);
create index guests_spend_idx on public.guests (lifetime_spend_pence);
create index guests_consent_idx on public.guests (email_consent, sms_consent);
create index guests_created_idx on public.guests (created_at);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,              -- e.g. BTH-7K2Q
  guest_id uuid not null references public.guests (id) on delete cascade,
  event_night_id uuid not null references public.event_nights (id),
  entry_time time not null,                    -- entry slot, e.g. 19:30
  ticket_type ticket_type not null,
  group_size integer not null check (group_size > 0),
  addons text[] not null default '{}',
  total_paid_pence integer not null check (total_paid_pence >= 0),
  refunded_pence integer not null default 0 check (refunded_pence >= 0),
  status booking_status not null default 'confirmed',
  source_campaign_id uuid,                     -- attributed campaign, set later
  booked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_guest_idx on public.bookings (guest_id, booked_at desc);
create index bookings_night_idx on public.bookings (event_night_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_type_idx on public.bookings (ticket_type);
create index bookings_booked_at_idx on public.bookings (booked_at);
create index bookings_reference_idx on public.bookings (upper(reference));
create index bookings_campaign_idx on public.bookings (source_campaign_id);

-- Human readable reference like BTH-7K2Q (no 0/O/1/I to avoid confusion).
create or replace function public.generate_booking_reference()
returns text language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ref text;
begin
  loop
    ref := 'BTH-';
    for i in 1..4 loop
      ref := ref || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where reference = ref);
  end loop;
  return ref;
end $$;

-- ---------------------------------------------------------------------------
-- Surveys
-- ---------------------------------------------------------------------------
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  overall_score integer not null check (overall_score between 1 and 10),
  maze_scores jsonb not null default '{}',     -- { "<maze slug>": 1..10 } for the mazes the guest rated
  comments text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index surveys_guest_idx on public.surveys (guest_id);
create index surveys_booking_idx on public.surveys (booking_id);
create index surveys_submitted_idx on public.surveys (submitted_at);
create index surveys_score_idx on public.surveys (overall_score);

-- ---------------------------------------------------------------------------
-- Marketing
-- ---------------------------------------------------------------------------
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '{"op":"and","rules":[]}',
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index segments_name_idx on public.segments (lower(name));

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel message_channel not null default 'email',
  segment_id uuid references public.segments (id) on delete set null,
  subject text,                                -- email only
  preheader text,
  blocks jsonb not null default '[]',          -- email block editor content
  sms_body text,                               -- sms only
  status campaign_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}',           -- recipients, excluded, opens, clicks...
  created_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_status_idx on public.campaigns (status, scheduled_for);
create index campaigns_segment_idx on public.campaigns (segment_id);

alter table public.bookings
  add constraint bookings_source_campaign_fk
  foreign key (source_campaign_id) references public.campaigns (id) on delete set null;

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  trigger automation_trigger not null unique,
  name text not null,
  description text not null default '',
  channel message_channel not null default 'email',
  -- Offset from the trigger moment in minutes. Negative means before the
  -- event (e.g. -2880 = 48 hours before the visit).
  delay_minutes integer not null default 0,
  send_at_time time,                           -- for "the morning after" style sends
  subject text,
  body text not null,                          -- plain text / simple markup with merge fields
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages_outbox (
  id uuid primary key default gen_random_uuid(),
  channel message_channel not null,
  guest_id uuid references public.guests (id) on delete set null,
  recipient_name text,
  recipient text not null,                     -- email address or phone number
  subject text,
  body_html text,
  body_text text not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  automation_id uuid references public.automations (id) on delete set null,
  ticket_id uuid,                              -- fk added after tickets exists
  status outbox_status not null default 'sent',
  sent_at timestamptz not null default now(),
  opened_at timestamptz,                       -- simulated engagement
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outbox_guest_idx on public.messages_outbox (guest_id, sent_at desc);
create index outbox_campaign_idx on public.messages_outbox (campaign_id);
create index outbox_automation_idx on public.messages_outbox (automation_id);
create index outbox_sent_idx on public.messages_outbox (sent_at desc);
create index outbox_channel_idx on public.messages_outbox (channel);

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number serial unique,                        -- short human id, e.g. #1042
  guest_id uuid references public.guests (id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  booking_id uuid references public.bookings (id) on delete set null,
  subject text not null,
  category text not null references public.ticket_categories (key),
  priority ticket_priority not null default 'normal',
  status ticket_status not null default 'new',
  assigned_to uuid references public.staff_users (id) on delete set null,
  source ticket_source not null default 'email',
  sla_due_at timestamptz not null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  root_cause text references public.root_cause_tags (key),
  final_response text,                         -- required for complaints
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on public.tickets (status, sla_due_at);
create index tickets_guest_idx on public.tickets (guest_id);
create index tickets_assigned_idx on public.tickets (assigned_to);
create index tickets_category_idx on public.tickets (category);
create index tickets_priority_idx on public.tickets (priority);
create index tickets_email_idx on public.tickets (lower(requester_email));
create index tickets_created_idx on public.tickets (created_at desc);
create index tickets_subject_idx on public.tickets (lower(subject));

alter table public.messages_outbox
  add constraint outbox_ticket_fk foreign key (ticket_id) references public.tickets (id) on delete set null;
create index outbox_ticket_idx on public.messages_outbox (ticket_id);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  direction message_direction not null,
  author_staff_id uuid references public.staff_users (id) on delete set null,
  author_name text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, sent_at);

create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text references public.ticket_categories (key) on delete set null,
  body text not null,                          -- supports {{merge_fields}}
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_replies_category_idx on public.saved_replies (category);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0),
  reason text not null,
  processed_by uuid references public.staff_users (id),
  provider_reference text,                     -- would come from the payment provider
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_booking_idx on public.refunds (booking_id);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  guest_id uuid references public.guests (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0),
  reason text not null,
  expires_on date not null,
  redeemed_at timestamptz,
  issued_by uuid references public.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vouchers_guest_idx on public.vouchers (guest_id);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigserial primary key,
  staff_id uuid references public.staff_users (id) on delete set null,
  staff_name text,
  action text not null,                        -- e.g. guest.updated, booking.refunded
  entity_type text not null,                   -- guest, booking, ticket, campaign...
  entity_id text not null,
  summary text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id, created_at desc);
create index activity_log_staff_idx on public.activity_log (staff_id, created_at desc);
create index activity_log_created_idx on public.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name not in ('ticket_products', 'addons')
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- Roles: admin (everything), marketing (guests read + marketing write),
-- support (guests/bookings + tickets write), front_desk (read + raise tickets).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
-- The public web form runs through the server with the service connection,
-- so anon needs nothing.

-- Reference data: every staff member can read, admins write.
create policy "staff read staff_users" on public.staff_users for select using (public.is_staff());
create policy "admin write staff_users" on public.staff_users for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read park_settings" on public.park_settings for select using (public.is_staff());
create policy "admin write park_settings" on public.park_settings for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read ticket_categories" on public.ticket_categories for select using (public.is_staff());
create policy "admin write ticket_categories" on public.ticket_categories for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read root_cause_tags" on public.root_cause_tags for select using (public.is_staff());
create policy "admin write root_cause_tags" on public.root_cause_tags for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read sla_policies" on public.sla_policies for select using (public.is_staff());
create policy "admin write sla_policies" on public.sla_policies for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read mazes" on public.mazes for select using (public.is_staff());
create policy "admin write mazes" on public.mazes for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read seasons" on public.seasons for select using (public.is_staff());
create policy "admin write seasons" on public.seasons for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read event_nights" on public.event_nights for select using (public.is_staff());
create policy "admin write event_nights" on public.event_nights for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "staff read ticket_products" on public.ticket_products for select using (public.is_staff());
create policy "staff read addons" on public.addons for select using (public.is_staff());

-- Guests: everyone reads; admin, marketing and support update; admin deletes.
create policy "staff read guests" on public.guests for select using (public.is_staff());
create policy "staff insert guests" on public.guests for insert with check (public.has_role('admin', 'marketing', 'support', 'front_desk'));
create policy "staff update guests" on public.guests for update using (public.has_role('admin', 'marketing', 'support')) with check (public.has_role('admin', 'marketing', 'support'));
create policy "admin delete guests" on public.guests for delete using (public.has_role('admin'));

-- Bookings: everyone reads; admin and support change them (refunds, moves).
create policy "staff read bookings" on public.bookings for select using (public.is_staff());
create policy "support write bookings" on public.bookings for insert with check (public.has_role('admin', 'support', 'front_desk'));
create policy "support update bookings" on public.bookings for update using (public.has_role('admin', 'support', 'front_desk')) with check (public.has_role('admin', 'support', 'front_desk'));
create policy "admin delete bookings" on public.bookings for delete using (public.has_role('admin'));

create policy "staff read surveys" on public.surveys for select using (public.is_staff());
create policy "admin write surveys" on public.surveys for all using (public.has_role('admin')) with check (public.has_role('admin'));

-- Marketing tables: everyone reads, admin and marketing write.
create policy "staff read segments" on public.segments for select using (public.is_staff());
create policy "marketing write segments" on public.segments for all using (public.has_role('admin', 'marketing')) with check (public.has_role('admin', 'marketing'));

create policy "staff read campaigns" on public.campaigns for select using (public.is_staff());
create policy "marketing write campaigns" on public.campaigns for all using (public.has_role('admin', 'marketing')) with check (public.has_role('admin', 'marketing'));

create policy "staff read automations" on public.automations for select using (public.is_staff());
create policy "marketing write automations" on public.automations for all using (public.has_role('admin', 'marketing')) with check (public.has_role('admin', 'marketing'));

-- Outbox: everyone reads; marketing and support send (campaigns, ticket replies).
create policy "staff read outbox" on public.messages_outbox for select using (public.is_staff());
create policy "staff insert outbox" on public.messages_outbox for insert with check (public.has_role('admin', 'marketing', 'support'));
create policy "admin delete outbox" on public.messages_outbox for delete using (public.has_role('admin'));

-- Support tables: everyone reads; admin and support write; front desk can raise.
create policy "staff read tickets" on public.tickets for select using (public.is_staff());
create policy "staff insert tickets" on public.tickets for insert with check (public.has_role('admin', 'support', 'front_desk'));
create policy "support update tickets" on public.tickets for update using (public.has_role('admin', 'support')) with check (public.has_role('admin', 'support'));
create policy "admin delete tickets" on public.tickets for delete using (public.has_role('admin'));

create policy "staff read ticket_messages" on public.ticket_messages for select using (public.is_staff());
create policy "staff insert ticket_messages" on public.ticket_messages for insert with check (public.has_role('admin', 'support', 'front_desk'));
create policy "admin delete ticket_messages" on public.ticket_messages for delete using (public.has_role('admin'));

create policy "staff read saved_replies" on public.saved_replies for select using (public.is_staff());
create policy "admin write saved_replies" on public.saved_replies for all using (public.has_role('admin', 'support')) with check (public.has_role('admin', 'support'));

create policy "staff read refunds" on public.refunds for select using (public.is_staff());
create policy "support insert refunds" on public.refunds for insert with check (public.has_role('admin', 'support'));

create policy "staff read vouchers" on public.vouchers for select using (public.is_staff());
create policy "support insert vouchers" on public.vouchers for insert with check (public.has_role('admin', 'support'));
create policy "support update vouchers" on public.vouchers for update using (public.has_role('admin', 'support')) with check (public.has_role('admin', 'support'));

-- Audit log: append only for staff, admins can read everything.
create policy "staff read activity_log" on public.activity_log for select using (public.is_staff());
create policy "staff insert activity_log" on public.activity_log for insert with check (public.is_staff());
