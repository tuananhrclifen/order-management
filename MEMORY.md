# Project Memory: Department Drink Ordering System

This note captures current status, decisions, and next actions so we can resume quickly later.

## Recent Changes
- Order page categories are now sorted logically, with priority items (New, Hot) first and Toppings last.
- Modernized landing page (full-bleed hero, smooth transitions, brand logo at `/public/logo.png`, optional `/public/hero.jpg`).
- Language switch in header (VI / 日本語 / EN). Order page translates names + categories using Gemini; shows JP/EN badges; search matches translated terms.
- Server-side translation cache (`translation_cache` table with service-role RLS) and client-side localStorage cache (7‑day TTL, signature-based).
- Admin utilities: Clear Translation Cache and Refresh Translations (JA/EN) with Gemini 2.0 Flash Experimental.
- Standalone crawler `tools/crawl-menu.mjs` with optional headless rendering and direct Storage uploads.
- Order page now shows full drink names, enforces name input with inline validation, and keeps the cart summary visible (sticky bottom on small screens, sidebar sticky on large).

## Current Status
- Deployed on Vercel from repo `tuananhrclifen/order-management` (branch `main`).
- Required env vars (Vercel):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_ADMIN_EMAILS`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_GENAI_API_KEY` (or `GEMINI_API_KEY`)
  - `TRANSLATE_MODEL` (default `gemini-2.0-flash-exp`)
- Supabase schema applied (events, drinks, orders + indexes). New table `translation_cache` (service-role RLS) for server-side translation caching.

## Implemented Features
- App stack: Next.js 14 + TypeScript + Tailwind.
- Auth: Supabase magic-link; admin allowlist via `NEXT_PUBLIC_ADMIN_EMAILS`.
- Admin UI:
  - Events: create/list.
  - Drinks: add/list, VND price formatting, import-from-URL form, utilities (Migrate Images to Storage, Clear Translation Cache, Refresh Translations (JA/EN), Delete ALL drinks by event).
  - Orders: filter by event/status, update status (advance or select), and export CSV.
- Public Order UI:
  - Card grid (image, name, price) with quantity +/- controls and a Cart Summary that is always visible (sticky on large screens).
  - Search by name/category; grouped by category.
  - Enter name once; single submit creates all line items.
  - Language switch (header): VI / 日本語 / EN. When set to JA/EN, names + categories translate using Gemini; small badge (JP/EN) shown next to translated names. Search matches both original and translated text.
- Crawl/Import API:
  - `POST /api/crawl/ingest` with `{ url, eventId }` (admin-only, token required).
  - Host-specific mappers: GrabFood and ShopeeFood/Foody; generic fallback using embedded `__NEXT_DATA__`.
  - Duplicate detection per event by normalized name + price; skips existing.
  - Image handling: read common JSON fields; HTML <img alt> fallback; uploads images to Supabase Storage bucket `menu-images` (public) and stores the public URL.

## How To Use (quick)
- Admin → Events: create an active event.
- Admin → Drinks: select event; paste menu URL; click Import (images auto-upload to Storage).
- Admin → Drinks → Utilities: Migrate Images (for existing items), Delete ALL drinks for the selected event.
- Admin → Orders: filter, update status, and export shopping list CSV.
- Public → Order: select event, enter your name, use +/- to add items, review Cart Summary, submit.

## Known Gaps / Next Steps
1) Realtime & operations
- Realtime updates for orders (Supabase Realtime) to reflect new/updated statuses without manual refresh.
- Admin bulk actions (multi-select status updates) and simple analytics.

2) Media & performance
- Image optimization via Next/Image with remotePatterns for Storage; optional CDN tuning.
- Basic caching for menu pages; guardrails/rate limiting on crawler frequency; robots.txt compliance.

3) Data model & UX
- Optional: add currency on events; per-event formatting and symbols.
- Optional: fuzzy duplicate detection on import (Levenshtein or token-based).

4) Testing
- Unit/integration tests for import, price parsing, RLS-protected flows, and order lifecycle; minimal E2E.

## Short Roadmap (priority)
- P1: Quantity +/- + cart summary on Order page. (Done)
- P2: Category grouping and search on Order page. (Done)
- P3: RLS policies + server actions for secure writes. (Done)
- P4: Export shopping list and basic admin order status workflow. (Done)
- P5: Improve importer (duplicate detection; source-specific mappers). (Done)
- P6: Realtime order updates + admin bulk actions.
- P7: Image optimization (Next/Image) + caching and rate limiting.
- P8: Tests coverage for importer and order flow.

## Security Changes (P3)
- Added RLS policies:
  - Events: public can read active; admins full access.
  - Drinks: public can read available for active events; admins full access.
  - Orders: public can insert for active events; admins can read/update/delete.
- Added `admin_users` table + `is_admin()` Postgres function; admins are synced from `NEXT_PUBLIC_ADMIN_EMAILS`.
- New API `POST /api/admin/sync` writes admin emails via service role after sign-in.
- Ingest API now requires admin token and uses service role for inserts.
- New server client `getSupabaseService()`; added `SUPABASE_SERVICE_ROLE_KEY` to env.

## Admin Ops (P4)
- Orders page: filter by event + status; change status via dropdown or advance button.
- Export CSV: aggregated quantities per drink for selected event and optional status filter.
- API `GET /api/orders/export?eventId=...&status=...`: requires admin token; returns CSV with columns Drink, Category, Price, Quantity, Total.

## Admin Utilities
- API `POST /api/admin/images/migrate` (admin-only): migrate external drink images to Supabase Storage and update image_url.
- API `POST /api/admin/drinks/clear` (admin-only): delete all drinks for an event (orders linked to those drinks are removed via cascade).

## Importer Improvements (P5)
- Duplicate detection during import: skip existing items by (lower(trim(name)), price, event).
- Source-specific mappers:
  - GrabFood: filters sold-out; extracts images and category.
  - ShopeeFood/Foody: mapper with sold-out handling; fallback to generic when needed.
- Fallback image scraping: if an item's image URL is missing, parse page <img> tags and match by alt text to attach a likely image.
- Storage uploads: for new items, download image and upload to Supabase Storage bucket `menu-images` (public); dedupe by SHA-1 content hash; reuse if already uploaded; replace `image_url` with public Storage URL.

## UX Tweaks
- Order page shows Cart Summary in a sticky side panel on large screens and as a sticky footer on smaller screens, so it's always visible.

## Notes
- Price formatting uses VND style (no decimals) via `formatPriceVND`.
- Importer respects public HTML only; be mindful of site terms.

## Latest Menu Crawls
- `crane-tea.json` / `crane-tea.sql`: Crane Tea Lê Trọng Tấn (event 90c538e1-5ad0-4adc-8d51-23301816d9b4).
- `maycha.json` / `maycha.sql`: Trà Sữa Maycha Đồng Đen (event 90c538e1-5ad0-4adc-8d51-23301816d9b4).
- `chulong.json` / `chulong.sql`: Cà Phê Muối Chú Long Cộng Hòa (event 90c538e1-5ad0-4adc-8d51-23301816d9b4).
