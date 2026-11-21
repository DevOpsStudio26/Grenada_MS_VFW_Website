-- VFW Grenada website database setup.
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- It is safe to run more than once.
--
-- Security model:
--   * Visitors (the "anon" role) can READ page content, events, and photos.
--   * Visitors submit membership applications through the submit-application
--     Edge Function (which also emails the post) and can never read them back.
--   * Only users listed in public.admins can change anything or read applications.
--   * These rules are enforced by the database itself (row level security), so
--     they hold even if someone tampers with the website's JavaScript.


-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Signed-in users can see only their own row (i.e. whether they are an admin).
-- Nobody can add, change, or remove admins through the API; that's done only
-- from the SQL Editor (see the bottom of this file).
drop policy if exists "Users can see their own admin row" on public.admins;
create policy "Users can see their own admin row" on public.admins
    for select to authenticated using (user_id = (select auth.uid()));

-- Returns true when the signed-in user is on the admin list. Runs with the
-- caller's own permissions (security invoker), and logged-out visitors can't call it.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- ---------------------------------------------------------------------------
-- Page content (the text, lists, and images edited from the Pages tab)
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
    key text primary key check (key in ('site', 'home', 'gallery', 'contact', 'donations', 'applications')),
    value jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object' and pg_column_size(value) < 200000),
    updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;

drop policy if exists "Anyone can read site content" on public.site_content;
create policy "Anyone can read site content" on public.site_content
    for select to anon, authenticated using (true);

drop policy if exists "Admins can change site content" on public.site_content;
create policy "Admins can change site content" on public.site_content
    for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(title) between 1 and 200),
    description text not null default '' check (char_length(description) <= 2000),
    event_date date not null,
    event_time text not null default '' check (char_length(event_time) <= 100),
    created_at timestamptz not null default now()
);
alter table public.events enable row level security;

-- Upgrades for event types, bands, flyers, and repeating events.
-- category/performer power the filters on the home page. Events created as a
-- repeating series share a series_id so they can be edited or deleted together.
alter table public.events add column if not exists category text not null default ''
    check (char_length(category) <= 50);
alter table public.events add column if not exists performer text not null default ''
    check (char_length(performer) <= 200);
alter table public.events add column if not exists series_id uuid;
alter table public.events add column if not exists repeat_label text not null default ''
    check (char_length(repeat_label) <= 100);
alter table public.events add column if not exists image_url text not null default ''
    check (char_length(image_url) <= 1000);
alter table public.events add column if not exists image_path text not null default ''
    check (char_length(image_path) <= 500);
-- Admission price shown as "Admission: $10" (picked from the admission dropdown list).
alter table public.events add column if not exists admission text not null default ''
    check (char_length(admission) <= 50);
create index if not exists events_date_idx on public.events (event_date);
create index if not exists events_series_idx on public.events (series_id, event_date);

drop policy if exists "Anyone can read events" on public.events;
create policy "Anyone can read events" on public.events
    for select to anon, authenticated using (true);

drop policy if exists "Admins can change events" on public.events;
create policy "Admins can change events" on public.events
    for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- Event dropdown choices (event types, bands, and admission prices)
-- ---------------------------------------------------------------------------
-- The choices admins pick from for an event's type, band, and admission. Admins
-- add and delete them from the Events tab; visitors filter by type and band on
-- the home page.
create table if not exists public.event_options (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    -- 50 fits events.category and events.admission (the shortest event columns).
    name text not null check (char_length(name) between 1 and 50),
    created_at timestamptz not null default now(),
    unique (kind, name)
);
alter table public.event_options enable row level security;
-- Replaces the original type/band-only rule so admission prices are allowed.
alter table public.event_options drop constraint if exists event_options_kind_check;
alter table public.event_options add constraint event_options_kind_check
    check (kind in ('type', 'band', 'admission'));

drop policy if exists "Anyone can read event options" on public.event_options;
create policy "Anyone can read event options" on public.event_options
    for select to anon, authenticated using (true);

drop policy if exists "Admins can change event options" on public.event_options;
create policy "Admins can change event options" on public.event_options
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Starting event types, plus any type or band already used on an event.
-- Safe to run again: existing choices are skipped, deleted ones aren't re-added
-- unless an event still uses them.
insert into public.event_options (kind, name)
select 'type', name from (values
    ('Dance Night'), ('Live Music'), ('Meeting'), ('Fundraiser'),
    ('Bingo'), ('Ceremony / Holiday'), ('Community'), ('Other')
) as defaults (name)
where not exists (select 1 from public.event_options where kind = 'type')
on conflict (kind, name) do nothing;

insert into public.event_options (kind, name)
select distinct 'type', category from public.events where category <> ''
on conflict (kind, name) do nothing;
insert into public.event_options (kind, name)
select distinct 'band', performer from public.events where performer <> '' and char_length(performer) <= 50
on conflict (kind, name) do nothing;

-- $10 is the starting admission price (and the default for new events).
insert into public.event_options (kind, name)
select 'admission', '$10'
where not exists (select 1 from public.event_options where kind = 'admission')
on conflict (kind, name) do nothing;


-- ---------------------------------------------------------------------------
-- Photos (gallery and home page slideshow)
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
    id uuid primary key default gen_random_uuid(),
    url text not null check (char_length(url) <= 1000),
    storage_path text not null check (char_length(storage_path) <= 500),
    caption text not null default '' check (char_length(caption) <= 300),
    in_slideshow boolean not null default false,
    created_at timestamptz not null default now()
);
alter table public.photos enable row level security;

drop policy if exists "Anyone can read photos" on public.photos;
create policy "Anyone can read photos" on public.photos
    for select to anon, authenticated using (true);

drop policy if exists "Admins can change photos" on public.photos;
create policy "Admins can change photos" on public.photos
    for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- Membership applications
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    first_name text not null check (char_length(first_name) between 1 and 100),
    last_name text not null check (char_length(last_name) between 1 and 100),
    email text not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
    phone text not null check (char_length(phone) between 7 and 30),
    address text not null check (char_length(address) between 1 and 200),
    city text not null check (char_length(city) between 1 and 100),
    state text not null check (char_length(state) between 1 and 50),
    zip text not null check (zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
    military_rank text not null default '' check (char_length(military_rank) <= 100),
    unit text not null default '' check (char_length(unit) <= 200),
    status text not null default 'new',
    admin_message text not null default '' check (char_length(admin_message) <= 5000),
    responded_at timestamptz,
    dd214_path text not null default '' check (char_length(dd214_path) <= 200),
    dd214_name text not null default '' check (char_length(dd214_name) <= 200),
    created_at timestamptz not null default now()
);
alter table public.applications enable row level security;

-- Upgrades a database created before applicant emails were added.
alter table public.applications add column if not exists admin_message text not null default ''
    check (char_length(admin_message) <= 5000);
alter table public.applications add column if not exists responded_at timestamptz;
alter table public.applications add column if not exists dd214_path text not null default ''
    check (char_length(dd214_path) <= 200);
alter table public.applications add column if not exists dd214_name text not null default ''
    check (char_length(dd214_name) <= 200);
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
    check (status in ('new', 'contacted', 'info_requested', 'approved', 'declined'));
create index if not exists applications_email_created_idx on public.applications (email, created_at);

-- New applications only come in through the submit-application Edge Function,
-- so every one is checked and emailed to the post. Visitors can't insert directly.
revoke insert on public.applications from anon, authenticated;
drop policy if exists "Anyone can submit an application" on public.applications;

drop policy if exists "Admins can read applications" on public.applications;
create policy "Admins can read applications" on public.applications
    for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update applications" on public.applications;
create policy "Admins can update applications" on public.applications
    for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete applications" on public.applications;
create policy "Admins can delete applications" on public.applications
    for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------------------
-- Image storage
-- ---------------------------------------------------------------------------
-- Public bucket so visitors can view images. SVG is deliberately not allowed
-- because SVG files can contain scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload site images" on storage.objects;
create policy "Admins can upload site images" on storage.objects
    for insert to authenticated with check (bucket_id = 'site-images' and public.is_admin());

drop policy if exists "Admins can update site images" on storage.objects;
create policy "Admins can update site images" on storage.objects
    for update to authenticated using (bucket_id = 'site-images' and public.is_admin());

drop policy if exists "Admins can delete site images" on storage.objects;
create policy "Admins can delete site images" on storage.objects
    for delete to authenticated using (bucket_id = 'site-images' and public.is_admin());


-- ---------------------------------------------------------------------------
-- DD-214 documents (uploaded with membership applications)
-- ---------------------------------------------------------------------------
-- PRIVATE bucket: these contain Social Security numbers. Files are added only by
-- the submit-application Edge Function, and admins open them through links that
-- expire after a few minutes. There is deliberately no insert policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dd214-documents', 'dd214-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can view DD-214 documents" on storage.objects;
create policy "Admins can view DD-214 documents" on storage.objects
    for select to authenticated using (bucket_id = 'dd214-documents' and public.is_admin());

drop policy if exists "Admins can delete DD-214 documents" on storage.objects;
create policy "Admins can delete DD-214 documents" on storage.objects
    for delete to authenticated using (bucket_id = 'dd214-documents' and public.is_admin());

-- Admins can add files to an application from the Forms tab (for example, a
-- document the applicant emailed in). Visitors still can't upload here directly.
drop policy if exists "Admins can upload DD-214 documents" on storage.objects;
create policy "Admins can upload DD-214 documents" on storage.objects
    for insert to authenticated with check (bucket_id = 'dd214-documents' and public.is_admin());


-- ---------------------------------------------------------------------------
-- Application documents (every file attached to an application)
-- ---------------------------------------------------------------------------
-- One row per file in the dd214-documents bucket. The applicant's upload is
-- added by the submit-application Edge Function; admins add and remove the rest.
create table if not exists public.application_documents (
    id uuid primary key default gen_random_uuid(),
    application_id uuid not null references public.applications (id) on delete cascade,
    storage_path text not null unique check (char_length(storage_path) between 1 and 200),
    file_name text not null check (char_length(file_name) between 1 and 200),
    added_by text not null default 'applicant' check (added_by in ('applicant', 'admin')),
    created_at timestamptz not null default now()
);
alter table public.application_documents enable row level security;
create index if not exists application_documents_application_idx
    on public.application_documents (application_id, created_at);

drop policy if exists "Admins can read application documents" on public.application_documents;
create policy "Admins can read application documents" on public.application_documents
    for select to authenticated using (public.is_admin());

drop policy if exists "Admins can add application documents" on public.application_documents;
create policy "Admins can add application documents" on public.application_documents
    for insert to authenticated with check (public.is_admin() and added_by = 'admin');

drop policy if exists "Admins can delete application documents" on public.application_documents;
create policy "Admins can delete application documents" on public.application_documents
    for delete to authenticated using (public.is_admin());

-- Moves DD-214s saved before this table existed into it. Safe to run again.
insert into public.application_documents (application_id, storage_path, file_name, added_by, created_at)
select id, dd214_path, coalesce(nullif(dd214_name, ''), 'DD-214'), 'applicant', created_at
from public.applications
where dd214_path <> ''
on conflict (storage_path) do nothing;
update public.applications set dd214_path = '', dd214_name = '' where dd214_path <> '';


-- ---------------------------------------------------------------------------
-- Adding an admin
-- ---------------------------------------------------------------------------
-- 1. Dashboard -> Authentication -> Users -> Add user -> Create new user
--    (enter their email and a strong password, check "Auto Confirm User").
-- 2. Run this, with their email:
--
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'person@example.com';
--
-- To remove an admin:
-- delete from public.admins
-- where user_id = (select id from auth.users where email = 'person@example.com');
