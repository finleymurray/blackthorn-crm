-- ===========================================================================
-- Blackthorn Scream Park CRM: core schema
-- Rebuilds the whole database from scratch. Money is stored in pence.
-- All timestamps are timestamptz; the app renders them in Europe/London.
-- ===========================================================================

-- Everything lives in its own schema so the CRM can share a database with
-- other apps without touching their tables.
create schema if not exists crm;
set search_path = crm, public, extensions;
create extension if not exists pgcrypto with schema extensions;

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
create or replace function crm.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
create table crm.staff_users (
  id uuid primary key,                         -- matches auth.users.id
  name text not null,
  email text not null unique,
  role staff_role not null default 'support',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_users_role_idx on crm.staff_users (role);

-- The role of the signed in staff member. Used by every RLS policy.
create or replace function crm.current_staff_role()
returns staff_role
language sql stable security definer set search_path = crm, public as $$
  select role from crm.staff_users where id = auth.uid() and active;
$$;

create or replace function crm.is_staff()
returns boolean language sql stable as $$
  select crm.current_staff_role() is not null;
$$;

create or replace function crm.has_role(variadic roles staff_role[])
returns boolean language sql stable as $$
  select crm.current_staff_role() = any (roles);
$$;

-- ---------------------------------------------------------------------------
-- Park settings and reference data
-- ---------------------------------------------------------------------------
create table crm.park_settings (
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
insert into crm.park_settings (id) values (1);

create table crm.ticket_categories (
  key text primary key,
  label text not null,
  default_priority ticket_priority not null default 'normal',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crm.root_cause_tags (
  key text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hours allowed to first response / resolution per priority.
create table crm.sla_policies (
  priority ticket_priority primary key,
  hours integer not null check (hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Mazes, seasons, nights
-- ---------------------------------------------------------------------------
create table crm.mazes (
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

create table crm.seasons (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crm.event_nights (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references crm.seasons (id) on delete cascade,
  date date not null unique,
  opens_at time not null default '18:00',
  closes_at time not null default '23:00',
  capacity integer not null check (capacity > 0),
  status event_night_status not null default 'on_sale',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_nights_season_idx on crm.event_nights (season_id, date);

create table crm.ticket_products (
  key ticket_type primary key,
  name text not null,
  price_pence integer not null check (price_pence >= 0),
  description text not null default ''
);

create table crm.addons (
  key text primary key,
  name text not null,
  price_pence integer not null check (price_pence >= 0)
);

-- ---------------------------------------------------------------------------
-- Guests
-- ---------------------------------------------------------------------------
create table crm.guests (
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
create index guests_last_name_idx on crm.guests (lower(last_name), lower(first_name));
create index guests_email_idx on crm.guests (lower(email));
create index guests_phone_idx on crm.guests (phone);
create index guests_postcode_idx on crm.guests (upper(replace(postcode, ' ', '')));
create index guests_tags_idx on crm.guests using gin (tags);
create index guests_last_visit_idx on crm.guests (last_visit_on);
create index guests_spend_idx on crm.guests (lifetime_spend_pence);
create index guests_consent_idx on crm.guests (email_consent, sms_consent);
create index guests_created_idx on crm.guests (created_at);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table crm.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,              -- e.g. BTH-7K2Q
  guest_id uuid not null references crm.guests (id) on delete cascade,
  event_night_id uuid not null references crm.event_nights (id),
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
create index bookings_guest_idx on crm.bookings (guest_id, booked_at desc);
create index bookings_night_idx on crm.bookings (event_night_id);
create index bookings_status_idx on crm.bookings (status);
create index bookings_type_idx on crm.bookings (ticket_type);
create index bookings_booked_at_idx on crm.bookings (booked_at);
create index bookings_reference_idx on crm.bookings (upper(reference));
create index bookings_campaign_idx on crm.bookings (source_campaign_id);

-- Human readable reference like BTH-7K2Q (no 0/O/1/I to avoid confusion).
create or replace function crm.generate_booking_reference()
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
    exit when not exists (select 1 from crm.bookings where reference = ref);
  end loop;
  return ref;
end $$;

-- ---------------------------------------------------------------------------
-- Surveys
-- ---------------------------------------------------------------------------
create table crm.surveys (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references crm.guests (id) on delete cascade,
  booking_id uuid not null references crm.bookings (id) on delete cascade,
  overall_score integer not null check (overall_score between 1 and 10),
  maze_scores jsonb not null default '{}',     -- { "<maze slug>": 1..10 } for the mazes the guest rated
  comments text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index surveys_guest_idx on crm.surveys (guest_id);
create index surveys_booking_idx on crm.surveys (booking_id);
create index surveys_submitted_idx on crm.surveys (submitted_at);
create index surveys_score_idx on crm.surveys (overall_score);

-- ---------------------------------------------------------------------------
-- Marketing
-- ---------------------------------------------------------------------------
create table crm.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules jsonb not null default '{"op":"and","rules":[]}',
  created_by uuid references crm.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index segments_name_idx on crm.segments (lower(name));

create table crm.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel message_channel not null default 'email',
  segment_id uuid references crm.segments (id) on delete set null,
  subject text,                                -- email only
  preheader text,
  blocks jsonb not null default '[]',          -- email block editor content
  sms_body text,                               -- sms only
  status campaign_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}',           -- recipients, excluded, opens, clicks...
  created_by uuid references crm.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_status_idx on crm.campaigns (status, scheduled_for);
create index campaigns_segment_idx on crm.campaigns (segment_id);

alter table crm.bookings
  add constraint bookings_source_campaign_fk
  foreign key (source_campaign_id) references crm.campaigns (id) on delete set null;

create table crm.automations (
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

create table crm.messages_outbox (
  id uuid primary key default gen_random_uuid(),
  channel message_channel not null,
  guest_id uuid references crm.guests (id) on delete set null,
  recipient_name text,
  recipient text not null,                     -- email address or phone number
  subject text,
  body_html text,
  body_text text not null,
  campaign_id uuid references crm.campaigns (id) on delete set null,
  automation_id uuid references crm.automations (id) on delete set null,
  ticket_id uuid,                              -- fk added after tickets exists
  status outbox_status not null default 'sent',
  sent_at timestamptz not null default now(),
  opened_at timestamptz,                       -- simulated engagement
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outbox_guest_idx on crm.messages_outbox (guest_id, sent_at desc);
create index outbox_campaign_idx on crm.messages_outbox (campaign_id);
create index outbox_automation_idx on crm.messages_outbox (automation_id);
create index outbox_sent_idx on crm.messages_outbox (sent_at desc);
create index outbox_channel_idx on crm.messages_outbox (channel);

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
create table crm.tickets (
  id uuid primary key default gen_random_uuid(),
  number serial unique,                        -- short human id, e.g. #1042
  guest_id uuid references crm.guests (id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  booking_id uuid references crm.bookings (id) on delete set null,
  subject text not null,
  category text not null references crm.ticket_categories (key),
  priority ticket_priority not null default 'normal',
  status ticket_status not null default 'new',
  assigned_to uuid references crm.staff_users (id) on delete set null,
  source ticket_source not null default 'email',
  sla_due_at timestamptz not null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  root_cause text references crm.root_cause_tags (key),
  final_response text,                         -- required for complaints
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on crm.tickets (status, sla_due_at);
create index tickets_guest_idx on crm.tickets (guest_id);
create index tickets_assigned_idx on crm.tickets (assigned_to);
create index tickets_category_idx on crm.tickets (category);
create index tickets_priority_idx on crm.tickets (priority);
create index tickets_email_idx on crm.tickets (lower(requester_email));
create index tickets_created_idx on crm.tickets (created_at desc);
create index tickets_subject_idx on crm.tickets (lower(subject));

alter table crm.messages_outbox
  add constraint outbox_ticket_fk foreign key (ticket_id) references crm.tickets (id) on delete set null;
create index outbox_ticket_idx on crm.messages_outbox (ticket_id);

create table crm.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references crm.tickets (id) on delete cascade,
  direction message_direction not null,
  author_staff_id uuid references crm.staff_users (id) on delete set null,
  author_name text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on crm.ticket_messages (ticket_id, sent_at);

create table crm.saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text references crm.ticket_categories (key) on delete set null,
  body text not null,                          -- supports {{merge_fields}}
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_replies_category_idx on crm.saved_replies (category);

create table crm.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references crm.bookings (id) on delete cascade,
  ticket_id uuid references crm.tickets (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0),
  reason text not null,
  processed_by uuid references crm.staff_users (id),
  provider_reference text,                     -- would come from the payment provider
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_booking_idx on crm.refunds (booking_id);

create table crm.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  guest_id uuid references crm.guests (id) on delete set null,
  ticket_id uuid references crm.tickets (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0),
  reason text not null,
  expires_on date not null,
  redeemed_at timestamptz,
  issued_by uuid references crm.staff_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vouchers_guest_idx on crm.vouchers (guest_id);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table crm.activity_log (
  id bigserial primary key,
  staff_id uuid references crm.staff_users (id) on delete set null,
  staff_name text,
  action text not null,                        -- e.g. guest.updated, booking.refunded
  entity_type text not null,                   -- guest, booking, ticket, campaign...
  entity_id text not null,
  summary text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activity_log_entity_idx on crm.activity_log (entity_type, entity_id, created_at desc);
create index activity_log_staff_idx on crm.activity_log (staff_id, created_at desc);
create index activity_log_created_idx on crm.activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'crm' and table_type = 'BASE TABLE'
      and table_name not in ('ticket_products', 'addons')
  loop
    execute format('create trigger %I_updated_at before update on crm.%I for each row execute function crm.set_updated_at()', t, t);
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
    where table_schema = 'crm' and table_type = 'BASE TABLE'
  loop
    execute format('alter table crm.%I enable row level security', t);
  end loop;
end $$;

grant usage on schema crm to authenticated, service_role;
grant all on all tables in schema crm to authenticated, service_role;
grant all on all sequences in schema crm to authenticated, service_role;
grant execute on all functions in schema crm to authenticated, service_role;
alter default privileges in schema crm grant all on tables to authenticated, service_role;
alter default privileges in schema crm grant all on sequences to authenticated, service_role;
-- The public web form runs through the server with the service connection,
-- so anon needs nothing.

-- Reference data: every staff member can read, admins write.
create policy "staff read staff_users" on crm.staff_users for select using (crm.is_staff());
create policy "admin write staff_users" on crm.staff_users for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read park_settings" on crm.park_settings for select using (crm.is_staff());
create policy "admin write park_settings" on crm.park_settings for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read ticket_categories" on crm.ticket_categories for select using (crm.is_staff());
create policy "admin write ticket_categories" on crm.ticket_categories for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read root_cause_tags" on crm.root_cause_tags for select using (crm.is_staff());
create policy "admin write root_cause_tags" on crm.root_cause_tags for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read sla_policies" on crm.sla_policies for select using (crm.is_staff());
create policy "admin write sla_policies" on crm.sla_policies for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read mazes" on crm.mazes for select using (crm.is_staff());
create policy "admin write mazes" on crm.mazes for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read seasons" on crm.seasons for select using (crm.is_staff());
create policy "admin write seasons" on crm.seasons for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read event_nights" on crm.event_nights for select using (crm.is_staff());
create policy "admin write event_nights" on crm.event_nights for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

create policy "staff read ticket_products" on crm.ticket_products for select using (crm.is_staff());
create policy "staff read addons" on crm.addons for select using (crm.is_staff());

-- Guests: everyone reads; admin, marketing and support update; admin deletes.
create policy "staff read guests" on crm.guests for select using (crm.is_staff());
create policy "staff insert guests" on crm.guests for insert with check (crm.has_role('admin', 'marketing', 'support', 'front_desk'));
create policy "staff update guests" on crm.guests for update using (crm.has_role('admin', 'marketing', 'support')) with check (crm.has_role('admin', 'marketing', 'support'));
create policy "admin delete guests" on crm.guests for delete using (crm.has_role('admin'));

-- Bookings: everyone reads; admin and support change them (refunds, moves).
create policy "staff read bookings" on crm.bookings for select using (crm.is_staff());
create policy "support write bookings" on crm.bookings for insert with check (crm.has_role('admin', 'support', 'front_desk'));
create policy "support update bookings" on crm.bookings for update using (crm.has_role('admin', 'support', 'front_desk')) with check (crm.has_role('admin', 'support', 'front_desk'));
create policy "admin delete bookings" on crm.bookings for delete using (crm.has_role('admin'));

create policy "staff read surveys" on crm.surveys for select using (crm.is_staff());
create policy "admin write surveys" on crm.surveys for all using (crm.has_role('admin')) with check (crm.has_role('admin'));

-- Marketing tables: everyone reads, admin and marketing write.
create policy "staff read segments" on crm.segments for select using (crm.is_staff());
create policy "marketing write segments" on crm.segments for all using (crm.has_role('admin', 'marketing')) with check (crm.has_role('admin', 'marketing'));

create policy "staff read campaigns" on crm.campaigns for select using (crm.is_staff());
create policy "marketing write campaigns" on crm.campaigns for all using (crm.has_role('admin', 'marketing')) with check (crm.has_role('admin', 'marketing'));

create policy "staff read automations" on crm.automations for select using (crm.is_staff());
create policy "marketing write automations" on crm.automations for all using (crm.has_role('admin', 'marketing')) with check (crm.has_role('admin', 'marketing'));

-- Outbox: everyone reads; marketing and support send (campaigns, ticket replies).
create policy "staff read outbox" on crm.messages_outbox for select using (crm.is_staff());
create policy "staff insert outbox" on crm.messages_outbox for insert with check (crm.has_role('admin', 'marketing', 'support'));
create policy "marketing update outbox" on crm.messages_outbox for update using (crm.has_role('admin', 'marketing')) with check (crm.has_role('admin', 'marketing'));
create policy "admin delete outbox" on crm.messages_outbox for delete using (crm.has_role('admin'));

-- Support tables: everyone reads; admin and support write; front desk can raise.
create policy "staff read tickets" on crm.tickets for select using (crm.is_staff());
create policy "staff insert tickets" on crm.tickets for insert with check (crm.has_role('admin', 'support', 'front_desk'));
create policy "support update tickets" on crm.tickets for update using (crm.has_role('admin', 'support')) with check (crm.has_role('admin', 'support'));
create policy "admin delete tickets" on crm.tickets for delete using (crm.has_role('admin'));

create policy "staff read ticket_messages" on crm.ticket_messages for select using (crm.is_staff());
create policy "staff insert ticket_messages" on crm.ticket_messages for insert with check (crm.has_role('admin', 'support', 'front_desk'));
create policy "admin delete ticket_messages" on crm.ticket_messages for delete using (crm.has_role('admin'));

create policy "staff read saved_replies" on crm.saved_replies for select using (crm.is_staff());
create policy "admin write saved_replies" on crm.saved_replies for all using (crm.has_role('admin', 'support')) with check (crm.has_role('admin', 'support'));

create policy "staff read refunds" on crm.refunds for select using (crm.is_staff());
create policy "support insert refunds" on crm.refunds for insert with check (crm.has_role('admin', 'support'));

create policy "staff read vouchers" on crm.vouchers for select using (crm.is_staff());
create policy "support insert vouchers" on crm.vouchers for insert with check (crm.has_role('admin', 'support'));
create policy "support update vouchers" on crm.vouchers for update using (crm.has_role('admin', 'support')) with check (crm.has_role('admin', 'support'));

-- Audit log: append only for staff, admins can read everything.
create policy "staff read activity_log" on crm.activity_log for select using (crm.is_staff());
create policy "staff insert activity_log" on crm.activity_log for insert with check (crm.is_staff());
