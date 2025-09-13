# Crawl & Import Guide

This guide shows how to crawl a new menu link (GrabFood, ShopeeFood/Foody, or generic Next.js sites) and import the data into Supabase so it appears in the web app.

## Prerequisites
- Node.js 18+
- Repo installed (this folder contains `tools/crawl-menu.mjs`).
- Create an Event in the app Admin or in Supabase, and copy its `id` (UUID).
- Optional (recommended for image capture):
  - Install Playwright: `npm i -D playwright` then `npx playwright install chromium`
  - Or install Puppeteer: `npm i -D puppeteer`

## Supabase Storage (optional, recommended)
If you want the crawler to upload images directly to Supabase Storage and rewrite image URLs to public Storage URLs, set credentials via flags or env:
- Env (PowerShell):
  - `$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"`
  - `$env:SUPABASE_SERVICE_ROLE_KEY = "<SERVICE_ROLE_KEY>"`
- Or pass flags: `--supabase-url` and `--supabase-key`
- Storage bucket defaults to `menu-images` (auto-created if missing). Override via `--storage-bucket`.

## One‑Shot: Crawl → Upload Images → JSON + SQL
Use this for most GrabFood links.

- Command (Windows PowerShell, replace placeholders):
  - `npm run crawl -- --url "<MENU_URL>" --headless --storage-upload --event-id <EVENT_UUID> --format both --out menu.json --sql-out menu.sql`

- What it does:
  - Renders page (headless) to extract items.
  - Uploads images to Supabase Storage and rewrites `image_url` to public Storage URLs.
  - Writes `menu.json` for inspection and `menu.sql` for import.

- Import to Supabase:
  - Open Supabase SQL editor for your project.
  - Paste and run `menu.sql`.

## Two‑Step: Crawl Now → SQL Later
- Crawl JSON only (plus optional local image download):
  - `npm run crawl -- --url "<MENU_URL>" --headless --out menu.json --download-images --images-dir crawl_images/site`
- Generate SQL later from JSON:
  - `npm run crawl -- --from-json menu.json --format sql --event-id <EVENT_UUID> --sql-out menu.sql`
  - Add `--storage-upload` to upload and rewrite image URLs while generating SQL.

## Without Direct Storage Upload
If you skip `--storage-upload`, the crawler stores external image URLs.
- After importing SQL, go to Admin → Drinks → Utilities → "Migrate Images to Storage" to move images into Supabase Storage and update URLs.

## Helpful Options
- `--wait-selector "<css>"` Wait until a selector exists (helps slow pages), e.g. `img` or a menu card selector.
- `--wait-until load|domcontentloaded|networkidle` Default: `networkidle`.
- `--timeout-ms 45000` Increase if needed.
- `--ua "<user-agent>"` Custom user agent string.
- `--limit 200` Limit number of items (default 300, max 1000).

## Getting Your Event ID
- From Admin → Events, or in Supabase SQL:
  - `select id, name, created_at from public.events order by created_at desc limit 10;`

## Example (GrabFood)
1) Set credentials (PowerShell):
- `$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"`
- `$env:SUPABASE_SERVICE_ROLE_KEY = "<SERVICE_ROLE_KEY>"`

2) Run crawl + upload + SQL:
- `npm run crawl -- --url "https://food.grab.com/vn/vi/restaurant/..." --headless --storage-upload --event-id <EVENT_UUID> --format both --out grab.json --sql-out grab.sql`

3) Import `grab.sql` in Supabase SQL editor.

4) Verify in the app:
- Admin → Drinks: select the event to see items.
- Public → Order: ensure the event is active and items are `is_available = true`.

## Dedupe Behavior
- The generated SQL inserts only when there is no existing row for the same event with the same `(lower(trim(name)), price)`.
- When using `--storage-upload`, the SQL also includes UPDATE statements to set Storage `image_url` for existing rows that don’t yet use a Storage URL.

## Troubleshooting
- Images show as 0 in JSON:
  - Add `--headless` and `--wait-selector "img"` (or a more specific selector), raise `--timeout-ms`.
- Import succeeds but images are external:
  - Either rerun with `--storage-upload` or use Admin → Utilities → Migrate Images.
- Rate limiting / site policies:
  - Be respectful of terms and traffic; adjust runs accordingly.

## Notes
- This tool targets public HTML/embedded Next.js data. Avoid bypassing protections or violating terms of service.
- Storage paths are `<eventId>/<sha1>.<ext>` in the `menu-images` bucket.
- JSON output includes `storage_path` when `--storage-upload` is used.
