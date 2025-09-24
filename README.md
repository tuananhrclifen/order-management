# Department Drink Ordering System

Phase 1 scaffold for the web app using Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Getting Started

1. Prerequisites
   - Node.js 18+
   - Supabase project (URL + anon key)

2. Configure environment
   - Copy `.env.example` to `.env.local` and set:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_ADMIN_EMAILS` (comma-separated list of admin emails)

3. Database
   - In Supabase SQL editor, run `supabase/migrations/0001_initial.sql` to create tables and indexes.

4. Install & run
   ```bash
   npm install
   npm run dev
   ```

5. Usage
   - Visit `/admin` and sign in via magic link using an email present in `NEXT_PUBLIC_ADMIN_EMAILS`.
   - Create an event on `/admin/events`.
   - Add drinks on `/admin/drinks` for the event.
   - Share `/order` for users to place orders on active events.

## Notes
### Import a plain-text menu

```
node tools/import-text-menu.mjs --file menunuoccam.txt --event-id 870a5ab9-32bc-4d36-b7b8-8b49ccb1c0dd --price 20000
```

You will need `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set (or pass `--supabase-url` / `--supabase-key`). Each line becomes a drink name at the selected price.


- Auth & RLS: This scaffold uses client-side Supabase writes for simplicity. Add RLS policies in Supabase for production and consider server-side actions with a service role for privileged ops.
- CI/CD: Connect this repo to Vercel. Set environment variables in Vercel project settings. Default Next.js build works without extra config.
- Next steps (Phase 2+): File import (CSV/JSON/MD), SSE updates, order workflow, exports.

## Translation (Gemini)

The Order page can translate drink names and categories to Japanese or English. Toggle language at the top right.

Environment variables (set in `.env.local` or your hosting provider):

- `GOOGLE_GENAI_API_KEY` or `GEMINI_API_KEY`: your Gemini API key
- `TRANSLATE_MODEL` (optional): defaults to `gemini-2.0-flash-exp`

Endpoint used: `POST /api/translate` with body `{ texts: string[], sourceLang: 'vi', targetLang: 'ja' | 'en' }`.
When no API key is configured, the endpoint returns original strings unchanged.



