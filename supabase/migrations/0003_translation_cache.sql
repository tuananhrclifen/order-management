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

-- Lock down via RLS; only service role (and thus our server API) may read/write directly.
alter table public.translation_cache enable row level security;

drop policy if exists service_all_translation_cache on public.translation_cache;
create policy service_all_translation_cache
  on public.translation_cache for all
  using ((auth.jwt() ->> 'role') = 'service_role')
  with check ((auth.jwt() ->> 'role') = 'service_role');
