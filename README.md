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

- Auth & RLS: This scaffold uses client-side Supabase writes for simplicity. Add RLS policies in Supabase for production and consider server-side actions with a service role for privileged ops.
- CI/CD: Connect this repo to Vercel. Set environment variables in Vercel project settings. Default Next.js build works without extra config.
- Next steps (Phase 2+): File import (CSV/JSON/MD), SSE updates, order workflow, exports.

