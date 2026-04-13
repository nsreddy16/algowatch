# Scripts

## Env vars

Ingest reads **`.env` and `.env.local`** from the project root. Required:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (not the anon key)

Optional:

- `EMBED_DIM` — embedding width (default `384`). Must match `dramas.embedding` and `drama_embeddings.npy` columns.

Run commands from the **project root** so env files resolve.

---

## Ingest (single command)

**One workflow** loads `mydramalist_kdramas_v2.json` and, if the files exist beside it, also loads:

- `drama_embeddings.npy` — shape `(N, D)` with `N` = JSON length and `D` = `EMBED_DIM`
- `drama_embeddings_2d.npy` — shape `(N, 2)` for `umap_x` / `umap_y`

Row order in the `.npy` files must match the JSON array order (same as the old Python script).

```bash
npm run ingest
```

This runs `scripts/ingest-all.mjs` (Node + `npyjs`). No separate Python step.

After a large load with embeddings, run in the Supabase SQL Editor:

```sql
analyze public.dramas;
```

Vector indexes come from migrations (e.g. `00002_dramas_vector_index.sql`) when you `supabase db push`; apply migrations **before** ingest.

---

## Legacy Python script

`ingest_dramas.py` is deprecated in favor of `npm run ingest`. Keep it only if you need a standalone Python environment without Node dependencies.

---

## update-drama-images.mjs

Updates existing `public.dramas` poster URLs from `mydramalist_kdramas_v2.json` (match on `link`).

```bash
npm run update-drama-images
```
