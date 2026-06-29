-- =====================================================================
--  ASAP Funding Pipeline schema
--  Run this once in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- leads ----------------------------------------------------
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  ghl_contact_id  text unique,                 -- dedupe key from GoHighLevel
  name            text not null default '',
  phone           text not null default '',
  email           text not null default '',
  notes           text not null default '',
  source          text not null default '',
  status          text not null default 'new',
  link_sent_at    timestamptz,
  last_touch_at   timestamptz,
  touches         jsonb not null default '[]'::jsonb,
  raw             jsonb,                        -- original webhook payload, for debugging
  created_at      timestamptz not null default now()
);

create index if not exists leads_status_idx     on public.leads (status);
create index if not exists leads_last_touch_idx on public.leads (last_touch_at desc);

-- ---------- app config (single row, key/value) ----------------------
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);

-- =====================================================================
--  Row Level Security
--  This is an INTERNAL tool with no per-user login. The policies below
--  let the public anon key read/write. The app should sit behind a
--  private/obscure URL. Tighten later by adding Supabase Auth and
--  swapping these for authenticated-only policies.
-- =====================================================================
alter table public.leads      enable row level security;
alter table public.app_config enable row level security;

drop policy if exists leads_anon_all  on public.leads;
drop policy if exists config_anon_all on public.app_config;

create policy leads_anon_all  on public.leads      for all using (true) with check (true);
create policy config_anon_all on public.app_config for all using (true) with check (true);

-- Let the frontend receive realtime inserts (new leads from the webhook)
alter publication supabase_realtime add table public.leads;
