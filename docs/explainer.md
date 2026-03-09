## Algowatch Postgres / Supabase Guide

You can copy-paste this into something like `docs/postgres-guide.md`.

---

### 1. Extensions

In Supabase SQL editor, enable the needed extensions:

```sql
-- Vector embeddings for similarity search
create extension if not exists vector;

-- Optional, for fuzzy title search on text
create extension if not exists pg_trgm;
```

- **`vector`**: stores embeddings in `vector` columns and supports `<->` distance operators.
- **`pg_trgm`** (optional): improves fuzzy title search (`ILIKE`, `%...%`).

---

### 2. Core schema

#### 2.1 `dramas` table (catalog + embeddings + UMAP)

Adjust types and dimensions to match your JSON:

```sql
create table public.dramas (
  id             bigint generated always as identity primary key,
  title          text not null,
  original_title text,
  media_type     text not null,         -- 'kdrama', 'cdrama', 'anime', etc.
  year           int,
  num_episodes   int,
  rating         numeric(3,1),          -- e.g. 8.7
  description    text,
  image_url      text,
  genres         text[] default '{}',   -- e.g. '{Romance,Fantasy}'
  tags           text[] default '{}',   -- user or dataset tags
  embedding      vector(768),           -- set 768 to your embedding dimension
  umap_x         double precision,
  umap_y         double precision,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
```

- **Embedding**: high-dimensional vector, used for cosine similarity / recommendations.
- **UMAP coordinates**: 2D projection used for visualization; no complex indexing needed.

#### 2.2 User-related tables

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id),
  username    text unique,
  avatar_url  text,
  created_at  timestamptz default now()
);

create table public.lists (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references public.profiles(id),
  name        text not null,
  description text,
  is_public   boolean default false,
  share_slug  text unique,  -- for /lists/[share_slug]
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.list_items (
  id        uuid default gen_random_uuid() primary key,
  list_id   uuid not null references public.lists(id) on delete cascade,
  drama_id  bigint not null references public.dramas(id),
  rank      int not null,
  notes     text
);
```

Optional `user_ratings`:

```sql
create table public.user_ratings (
  id        uuid default gen_random_uuid() primary key,
  user_id   uuid not null references public.profiles(id),
  drama_id  bigint not null references public.dramas(id),
  rating    int,         -- 1–10
  status    text,        -- 'watched', 'watching', 'plan_to_watch', etc.
  created_at timestamptz default now(),
  unique (user_id, drama_id)
);
```

---

### 3. Indexing strategy (and why)

#### 3.1 B-tree indexes (for filters/sorting)

For scalar filters and sorts (`WHERE`, `ORDER BY`):

```sql
create index dramas_year_idx         on public.dramas (year);
create index dramas_num_episodes_idx on public.dramas (num_episodes);
create index dramas_rating_idx       on public.dramas (rating);
create index dramas_media_type_idx   on public.dramas (media_type);
```

- **Use cases**:
  - Filter: `WHERE year BETWEEN 2015 AND 2020`
  - Filter: `WHERE rating >= 8.5`
  - Filter: `WHERE num_episodes <= 16`
  - Filter: `WHERE media_type = 'kdrama'`

Optional compound index if a pattern is extremely common (e.g. “all K-dramas ordered by rating”):

```sql
create index dramas_media_type_rating_idx
on public.dramas (media_type, rating desc);
```

Use compound indexes sparingly; each index has storage and update cost.

#### 3.2 GIN indexes (for genres/tags arrays)

Array columns are ideal for GIN:

```sql
create index dramas_genres_gin_idx on public.dramas using gin (genres);
create index dramas_tags_gin_idx   on public.dramas using gin (tags);
```

- **Queries that benefit**:
  - `genres @> array['Romance']::text[]` → contains Romance
  - `tags && array['time-travel','enemies-to-lovers']::text[]` → overlap

This powers your **multi-select chips** filtering in the UI.

#### 3.3 pgvector IVFFLAT index (for similarity)

For fast nearest-neighbor search on `embedding`:

```sql
create index dramas_embedding_ivfflat_idx
on public.dramas
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

- **Key points**:
  - `vector_cosine_ops` → cosine similarity (good for recommendations).
  - `lists` parameter controls clustering; 100–200 is a reasonable start for a few thousand items.
  - Works with `<->` operator in `ORDER BY`.

Example “similar to drama X”:

```sql
with target as (
  select embedding
  from public.dramas
  where id = 123
)
select d.*
from public.dramas d, target t
where d.id <> 123
order by d.embedding <-> t.embedding
limit 20;
```

This uses the IVFFLAT index for fast approximate nearest neighbors.

> Note: after loading data, run `analyze public.dramas;` to give the planner good statistics.

#### 3.4 UMAP coordinates

You usually fetch all (or many) UMAP points:

- **Index often not needed** because:
  - Visualization usually draws a large set, not small filtered subsets.
  - Access pattern is “load all points once” → sequential scan is fine.

If you later need bounding-box queries (lasso/selection on the plot), you can add:

```sql
create index dramas_umap_xy_idx on public.dramas (umap_x, umap_y);
```

---

### 4. Similarity search APIs (RPC)

#### 4.1 Similar dramas by drama id

Wrap the query as a Postgres function:

```sql
create or replace function public.get_similar_dramas(target_drama_id bigint, k int)
returns setof public.dramas
language sql
stable
as $$
  with target as (
    select embedding
    from public.dramas
    where id = target_drama_id
  )
  select d.*
  from public.dramas d, target t
  where d.id <> target_drama_id
  order by d.embedding <-> t.embedding
  limit k;
$$;
```

Call from Supabase JS:

```ts
const { data, error } = await supabase
  .rpc('get_similar_dramas', { target_drama_id: 123, k: 20 });
```

#### 4.2 User-based recommendations

Compute a **user embedding** by averaging embeddings of dramas in their list or with good ratings.

Example SQL (using list items):

```sql
with user_items as (
  select d.embedding
  from public.list_items li
  join public.lists l   on l.id = li.list_id
  join public.dramas d  on d.id = li.drama_id
  where l.user_id = auth.uid()
),
user_vec as (
  select avg(embedding) as embedding
  from user_items
)
select d.*
from public.dramas d, user_vec u
where not exists (
  select 1
  from public.list_items li
  join public.lists l on l.id = li.list_id
  where l.user_id = auth.uid()
    and li.drama_id = d.id
)
order by d.embedding <-> u.embedding
limit 50;
```

You can wrap this in an RPC function as well.

---

### 5. UMAP user point overlay

Approximate the user’s point in UMAP space by averaging `umap_x/umap_y` of their shows:

```sql
select
  avg(d.umap_x) as user_umap_x,
  avg(d.umap_y) as user_umap_y
from public.list_items li
join public.lists l  on l.id = li.list_id
join public.dramas d on d.id = li.drama_id
where l.user_id = auth.uid();
```

- Frontend:
  - Plot all dramas as scatter points.
  - Plot `(user_umap_x, user_umap_y)` as a distinct marker (e.g. larger, different color).
  - Optionally highlight all dramas in user’s list on the same plot.

---

### 6. Row Level Security (RLS)

#### 6.1 Enable RLS

```sql
alter table public.dramas      enable row level security;
alter table public.profiles    enable row level security;
alter table public.lists       enable row level security;
alter table public.list_items  enable row level security;
alter table public.user_ratings enable row level security;
```

#### 6.2 Catalog policies (`dramas`)

Catalog should be readable by both anonymous and authenticated users:

```sql
create policy "Allow anon read dramas"
on public.dramas
for select
using (true);
```

No insert/update/delete from the client (you’ll populate via a backend script or service key).

#### 6.3 Profiles

```sql
create policy "Users can view own profile"
on public.profiles
for select
using (id = auth.uid());

create policy "Users can update own profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());
```

#### 6.4 Lists and list items

Owner full control; public read when `is_public = true`.

```sql
create policy "Users manage own lists"
on public.lists
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Anyone can view public lists"
on public.lists
for select
using (is_public = true);
```

`list_items` tied to ownership of parent list:

```sql
create policy "Users manage items of own lists"
on public.list_items
for all
using (
  exists (
    select 1
    from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lists l
    where l.id = list_items.list_id
      and l.user_id = auth.uid()
  )
);
```

Optional `user_ratings`:

```sql
create policy "Users manage own ratings"
on public.user_ratings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

---

### 7. Practical setup order in Supabase

1. **Enable extensions**: `vector`, optionally `pg_trgm`.
2. **Create tables**: `dramas`, `profiles`, `lists`, `list_items`, `user_ratings`.
3. **Create indexes**:
   - B-tree on `year`, `num_episodes`, `rating`, `media_type`.
   - GIN on `genres`, `tags`.
   - IVFFLAT on `embedding`.
4. **Enable RLS** and add policies.
5. **Import JSON data** into `dramas` (and set `embedding`, `umap_x`, `umap_y`).
6. Run:

   ```sql
   analyze public.dramas;
   ```

7. (Optional) Create RPC functions: `get_similar_dramas`, `get_user_recommendations`, etc.

---

If you’d like a single, copy-paste-able SQL migration that does all of this in one file, I can generate that next based on an embedding dimension you confirm (e.g. 384/512/768).