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
   - Apply migrations first (`supabase db push` or run the SQL in `supabase/migrations/`).
   - Run **`npm run ingest`** once to import `mydramalist_kdramas_v2.json` into `dramas`. Optional: place `drama_embeddings.npy` and `drama_embeddings_2d.npy` next to the JSON (same row order) to load vectors and UMAP in the same run.
   - After ingest with embeddings, run `analyze public.dramas;` in the SQL Editor (indexes are already created by migration `00002`).

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
