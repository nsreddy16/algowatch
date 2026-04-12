# Algowatch

Media recommendation app for Asian dramas (and later anime), with ranked lists, similarity search, and UMAP exploration. Built with Next.js, Supabase, and Tailwind.

## Setup

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - In SQL Editor, run `supabase/migrations/00001_initial_schema.sql`.
   - Enable Auth providers (Email, Google, GitHub) in Authentication → Providers.
   - Copy project URL and anon key (and service role key for ingest).

2. **Env**
   - Copy `.env.example` to `.env.local`.
   - Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optionally `SUPABASE_SERVICE_ROLE_KEY` for the ingest script.

3. **Data**
   - Run `npm run ingest` to import `mydramalist_kdramas_v2.json` into `dramas`.
   - If you add embeddings and UMAP coordinates to the data, run `supabase/migrations/00002_dramas_vector_index.sql` and `analyze public.dramas;`.

4. **Run**
   - `npm install && npm run dev` — app at [http://localhost:3000](http://localhost:3000).

**Build:** `npm run build` requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e.g. in `.env.local` or as build env vars). Use real Supabase values or placeholders for CI.

## Deploy (Vercel)

1. Push the repo to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** and import the repo.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon (publishable) key
4. Click **Deploy**. Vercel will run `npm run build` by default; no extra config needed.
5. Optional: add a custom domain under **Settings** → **Domains**.

## Docs

- [Postgres / Supabase guide](docs/POSTGRES_GUIDE.md)
- [Scripts (ingest)](scripts/README.md)
