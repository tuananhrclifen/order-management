-- Translation cache per event + language

create table if not exists public.translation_cache (
  event_id uuid not null references public.events(id) on delete cascade,
  lang text not null,
  sig text not null,
  map jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, lang)
);

create index if not exists idx_translation_cache_updated_at on public.translation_cache(updated_at);

-- Lock down via RLS; only admins (service role) should write/read directly.
alter table public.translation_cache enable row level security;

drop policy if exists admin_all_translation_cache on public.translation_cache;
create policy admin_all_translation_cache
  on public.translation_cache for all
  using (public.is_admin())
  with check (public.is_admin());

