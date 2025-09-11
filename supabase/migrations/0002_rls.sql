-- RLS policies and admin helpers

-- Enable required extension for gen_random_uuid (if not already enabled)
create extension if not exists "pgcrypto";

-- Admin users registry
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Lock down admin_users to service role only (no policies => denied for anon/auth)
alter table public.admin_users enable row level security;

-- Helper to check if current JWT's email is an admin
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.admin_users au
    where lower(au.email) = lower(coalesce(nullif((auth.jwt() ->> 'email'), ''), ''))
  );
$$;

-- Enable RLS on core tables
alter table public.events enable row level security;
alter table public.drinks enable row level security;
alter table public.orders enable row level security;

-- EVENTS
drop policy if exists public_select_active_events on public.events;
create policy public_select_active_events
  on public.events for select
  using (is_active = true);

drop policy if exists admin_all_events on public.events;
create policy admin_all_events
  on public.events for all
  using (public.is_admin())
  with check (public.is_admin());

-- DRINKS
drop policy if exists public_select_available_drinks on public.drinks;
create policy public_select_available_drinks
  on public.drinks for select
  using (
    is_available = true
    and exists(select 1 from public.events e where e.id = event_id and e.is_active)
  );

drop policy if exists admin_all_drinks on public.drinks;
create policy admin_all_drinks
  on public.drinks for all
  using (public.is_admin())
  with check (public.is_admin());

-- ORDERS
drop policy if exists public_insert_orders_active_event on public.orders;
create policy public_insert_orders_active_event
  on public.orders for insert
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.is_active)
  );

drop policy if exists admin_select_orders on public.orders;
create policy admin_select_orders
  on public.orders for select
  using (public.is_admin());

drop policy if exists admin_update_orders on public.orders;
create policy admin_update_orders
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_delete_orders on public.orders;
create policy admin_delete_orders
  on public.orders for delete
  using (public.is_admin());
