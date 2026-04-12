# Scripts

## Env vars

Both ingest scripts read **`.env` and `.env.local`** from the project root (Node script loads them automatically; Python script does the same). Use:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (required for ingest; not the anon/publishable key)

Run from project root so the scripts find the env files.

---

## ingest-dramas.mjs (JSON only)

Imports `mydramalist_kdramas_v2.json` into Supabase `public.dramas`. No embeddings/UMAP unless they are inside the JSON.

**Run**

```bash
node scripts/ingest-dramas.mjs
```

---

## update-drama-images.mjs

Updates existing `public.dramas` rows with poster URLs from `mydramalist_kdramas_v2.json`, matching on `link` (does not insert new rows). Uses the REST API only—no SQL migration required.

**Run**

```bash
npm run update-drama-images
```

Optional: `00003_apply_drama_image_batch.sql` adds an RPC for bulk updates if you prefer a single SQL function on very large catalogs.

---

## ingest_dramas.py (JSON + .npy embeddings/UMAP)

Imports dramas from the JSON and, if present, attaches embeddings and UMAP from NumPy files:

- `mydramalist_kdramas_v2.json` – drama metadata (required)
- `drama_embeddings.npy` – shape `(N, D)`; row `i` = drama `i` in the JSON
- `drama_embeddings_2d.npy` – shape `(N, 2)` for `umap_x`, `umap_y`

**Prerequisites**

- Supabase migration `00001_initial_schema.sql` applied.
- `dramas.embedding` is `vector(384)` by default. If your `.npy` has another dimension, set `EMBED_DIM=768` (or the right value) in `.env` and alter the column in Supabase to match.

**Run (from project root)**

```bash
python scripts/ingest_dramas.py
```

Uses the same env as above. After loading, run `00002_dramas_vector_index.sql` in Supabase for similarity search.
