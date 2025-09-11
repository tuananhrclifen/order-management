# Project Memory: Department Drink Ordering System

This note captures current status, decisions, and next actions so we can resume quickly later.

## Current Status
- Deployed on Vercel from repo `tuananhrclifen/order-management` (branch `main`).
- Env vars configured on Vercel UI:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_ADMIN_EMAILS`
- Supabase schema applied (events, drinks, orders + indexes).

## Implemented Features
- App stack: Next.js 14 + TypeScript + Tailwind.
- Auth: Supabase magic-link; admin allowlist via `NEXT_PUBLIC_ADMIN_EMAILS`.
- Admin UI:
  - Events: create/list.
  - Drinks: add/list, VND price formatting, delete button, import-from-URL form.
  - Orders: basic table view of recent orders.
- Public Order UI:
  - Card grid (image, name, VND price) with green “+” to add quantity 1.
  - Requires entering user name once; uses quick add for orders.
- Crawl/Import API:
  - `POST /api/crawl/ingest` with `{ url, eventId }`.
  - Parses embedded `__NEXT_DATA__`; GrabFood-specific parser for better accuracy; generic fallback.

## How To Use (quick)
- Admin → Events: create an active event.
- Admin → Drinks: select event; paste menu URL; click Import; optionally add manually.
- Public → Order: select event, enter your name, tap “+” to add items.

## Known Gaps / Next Steps
1) Order UX
- Add +/- quantity controls and a small cart summary before submit.
- Show category grouping headers; add search/filter.

2) Data integrity & security
- Add Supabase RLS policies and move privileged writes to server actions (service role) where appropriate.
- De-duplicate on import by (name, price, event); optional fuzzy matching.
- Optional: add `currency` on events; use per-event formatting (VND by default).

3) Operations & realtime
- Real-time updates for orders (SSE or Supabase Realtime) with admin status workflow (pending → confirmed → completed).
- Export shopping list (CSV/PDF) and basic analytics.

4) Media & performance
- Image optimization (Next/Image) and CDN.
- Basic caching for menus; guardrails on crawler frequency & robots.txt compliance.

5) Testing
- Unit/integration tests for import, price parsing, and order flow; minimal E2E for the happy path.

## Short Roadmap (priority)
- P1: Quantity +/- + cart summary on Order page. (Done)
- P2: Category grouping and search on Order page. (Done)
- P3: RLS policies + server actions for secure writes. (Done)
- P4: Export shopping list and basic admin order status workflow.
- P5: Improve importer (duplicate detection; source-specific mappers).

## Security Changes (P3)
- Added RLS policies:
  - Events: public can read active; admins can full access.
  - Drinks: public can read available for active events; admins full access.
  - Orders: public can insert for active events; admins can read/update/delete.
- Added `admin_users` table + `is_admin()` Postgres function; admins are synced from `NEXT_PUBLIC_ADMIN_EMAILS`.
- New API `POST /api/admin/sync` writes admin emails via service role after sign-in.
- Ingest API now requires admin token and uses service role for inserts.
- New server client `getSupabaseService()`; added `SUPABASE_SERVICE_ROLE_KEY` to env.

## Notes
- Price formatting uses VND style (no decimals) via `formatPriceVND`.
- Importer respects public HTML only; be mindful of site terms.
