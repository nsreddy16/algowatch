-- Run after populating public.dramas with embedding data.
-- lists = 100 is reasonable for ~2k rows.
create index if not exists dramas_embedding_ivfflat_idx
on public.dramas
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
