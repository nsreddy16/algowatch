# Algowatch Postgres / Supabase guide

## 1. Extensions

In Supabase SQL editor, run:

```sql
create extension if not exists vector;
create extension if not exists pg_trgm;
```

- **vector (pgvector)**: store embeddings and run cosine similarity with `<=>`.
- **pg_trgm**: optional; improves fuzzy title search.

---

## 2. Schema

See [supabase/migrations/00001_initial_schema.sql](../supabase/migrations/00001_initial_schema.sql) for the full schema: `dramas`, `profiles`, `lists`, `list_items`, `user_ratings`, indexes, RLS, and RPCs.

- **dramas**: catalog with `embedding vector(384)`, `umap_x`, `umap_y` (nullable until you add embeddings).
- **Vector index**: run [00002_dramas_vector_index.sql](../supabase/migrations/00002_dramas_vector_index.sql) after loading dramas with embeddings.

---

## 3. Indexes

- **B-tree**: `year`, `num_episodes`, `rating`, `media_type` for filters and sorting.
- **GIN**: `genres`, `tags` for `@>` / `&&` array queries.
- **IVFFLAT**: `embedding` with `vector_cosine_ops` for similarity search; create after data load.

---

## 4. RPCs

- `get_similar_dramas(p_target_drama_id, p_limit)`: nearest neighbors by embedding.
- `get_user_recommendations(p_limit)`: recommendations from average of user list embeddings.
- `get_user_umap_position()`: returns user’s average `(umap_x, umap_y)` from their list.

---

## 5. Setup order

1. Run `00001_initial_schema.sql` in Supabase.
2. Run the ingest script: `node scripts/ingest-dramas.mjs` (set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. If you added embeddings, run `00002_dramas_vector_index.sql`.
4. Run `analyze public.dramas;` after bulk load.
