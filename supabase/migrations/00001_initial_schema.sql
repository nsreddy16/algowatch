-- Algowatch: initial schema with pgvector, RLS, and RPCs
-- Run this in Supabase SQL Editor or via supabase db push

-- Extensions
create extension if not exists vector;
create extension if not exists pg_trgm;

-- Dramas catalog (static; populated from JSON import)
create table public.dramas (
  id             bigint generated always as identity primary key,
  title          text not null,
  original_title text,
  media_type     text not null,
  year           int,
  num_episodes   int,
  rating         numeric(3,1),
  description    text,
  image_url      text,
  link           text,
  genres         text[] default '{}',
  tags           text[] default '{}',
  main_actors    text[] default '{}',
  embedding      vector(384),           -- nullable until embeddings added; set dimension to match your model
  umap_x         double precision,
  umap_y         double precision,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Profiles (one per auth user)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- User lists (ranked, shareable)
create table public.lists (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  is_public   boolean default false,
  share_slug  text unique,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- List items (ranked entries)
create table public.list_items (
  id        uuid default gen_random_uuid() primary key,
  list_id   uuid not null references public.lists(id) on delete cascade,
  drama_id  bigint not null references public.dramas(id) on delete cascade,
  rank      int not null,
  notes     text,
  unique (list_id, drama_id)
);

-- Optional: user ratings for recommendations
create table public.user_ratings (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  drama_id   bigint not null references public.dramas(id) on delete cascade,
  rating     int check (rating >= 1 and rating <= 10),
  status     text,
  created_at timestamptz default now(),
  unique (user_id, drama_id)
);

-- B-tree indexes for filters/sorting
create index dramas_year_idx on public.dramas (year);
create index dramas_num_episodes_idx on public.dramas (num_episodes);
create index dramas_rating_idx on public.dramas (rating);
create index dramas_media_type_idx on public.dramas (media_type);
create index dramas_title_idx on public.dramas using btree (title text_pattern_ops);

-- GIN indexes for array filters
create index dramas_genres_gin_idx on public.dramas using gin (genres);
create index dramas_tags_gin_idx on public.dramas using gin (tags);

-- Vector index: run migration 00002 after loading dramas with embeddings (IVFFLAT needs rows).

-- List lookups
create index list_items_list_id_idx on public.list_items (list_id);
create index list_items_drama_id_idx on public.list_items (drama_id);
create index lists_user_id_idx on public.lists (user_id);
create index lists_share_slug_idx on public.lists (share_slug);
create index user_ratings_user_id_idx on public.user_ratings (user_id);

-- RLS
alter table public.dramas enable row level security;
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.user_ratings enable row level security;

-- Dramas: public read
create policy "Allow read dramas"
on public.dramas for select using (true);

-- Profiles: own row
create policy "Users can view own profile"
on public.profiles for select using (id = auth.uid());
create policy "Users can update own profile"
on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can insert own profile"
on public.profiles for insert with check (id = auth.uid());

-- Lists: owner full access; public read when is_public
create policy "Users manage own lists"
on public.lists for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy "Anyone can view public lists"
on public.lists for select using (is_public = true);

-- List items: via list ownership
create policy "Users manage items of own lists"
on public.list_items for all
using (
  exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid())
)
with check (
  exists (select 1 from public.lists l where l.id = list_items.list_id and l.user_id = auth.uid())
);
create policy "Anyone can view items of public lists"
on public.list_items for select
using (
  exists (select 1 from public.lists l where l.id = list_items.list_id and l.is_public = true)
);

-- User ratings: own only
create policy "Users manage own ratings"
on public.user_ratings for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC: similar dramas by drama id (uses pgvector)
create or replace function public.get_similar_dramas(p_target_drama_id bigint, p_limit int default 20)
returns setof public.dramas
language sql
stable
as $$
  with target as (
    select embedding from public.dramas where id = p_target_drama_id and embedding is not null
  )
  select d.*
  from public.dramas d, target t
  where d.id <> p_target_drama_id and d.embedding is not null
  order by d.embedding <=> t.embedding
  limit p_limit;
$$;

-- RPC: user recommendations (avg embedding of user's list)
create or replace function public.get_user_recommendations(p_limit int default 50)
returns setof public.dramas
language sql
stable
as $$
  with user_items as (
    select d.embedding
    from public.list_items li
    join public.lists l on l.id = li.list_id
    join public.dramas d on d.id = li.drama_id
    where l.user_id = auth.uid() and d.embedding is not null
  ),
  user_vec as (
    select avg(embedding) as embedding from user_items
  )
  select d.*
  from public.dramas d, user_vec u
  where d.embedding is not null
    and not exists (
      select 1 from public.list_items li
      join public.lists l on l.id = li.list_id
      where l.user_id = auth.uid() and li.drama_id = d.id
    )
  order by d.embedding <=> u.embedding
  limit p_limit;
$$;

-- RPC: user UMAP position (avg of list items' umap)
create or replace function public.get_user_umap_position()
returns table (umap_x double precision, umap_y double precision)
language sql
stable
as $$
  select avg(d.umap_x), avg(d.umap_y)
  from public.list_items li
  join public.lists l on l.id = li.list_id
  join public.dramas d on d.id = li.drama_id
  where l.user_id = auth.uid() and d.umap_x is not null and d.umap_y is not null;
$$;
