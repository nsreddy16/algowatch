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
  embedding      vector(384),
  umap_x         double precision,
  umap_y         double precision,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Profiles (one per auth user)
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text unique,
  avatar_url       text,
  taste_umap_x     double precision,
  taste_umap_y     double precision,
  taste_embedding  vector(384),
  taste_updated_at timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Single ranked collection per user per catalog (e.g. asian dramas; anime later)
create table public.user_ranked_dramas (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  catalog    text not null default 'asian',
  drama_id   bigint not null references public.dramas(id) on delete cascade,
  rank       int not null check (rank > 0),
  notes      text,
  created_at timestamptz default now(),
  unique (user_id, catalog, drama_id)
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

create index user_ranked_dramas_user_catalog_idx on public.user_ranked_dramas (user_id, catalog);
create index user_ranked_dramas_drama_id_idx on public.user_ranked_dramas (drama_id);
create index user_ratings_user_id_idx on public.user_ratings (user_id);

-- RLS
alter table public.dramas enable row level security;
alter table public.profiles enable row level security;
alter table public.user_ranked_dramas enable row level security;
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

-- Ranked dramas: own rows only
create policy "Users manage own ranked dramas"
on public.user_ranked_dramas for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

-- Linear rank weights: w = n - rank + 1 (rank 1 = highest weight)
-- Weighted centroid without vector*scalar: duplicate each embedding w times, then avg()
-- (Supabase pgvector builds often omit vector * float operators).

create or replace function public.weighted_taste_embedding(p_uid uuid, p_catalog text)
returns vector(384)
language sql
stable
as $$
  with cnt as (
    select count(*)::int as n
    from public.user_ranked_dramas urd
    where urd.user_id = p_uid and urd.catalog = p_catalog
  ),
  expanded as (
    select d.embedding
    from public.user_ranked_dramas urd
    cross join cnt c
    join public.dramas d on d.id = urd.drama_id
    cross join lateral generate_series(1, (c.n - urd.rank + 1)) as g(i)
    where urd.user_id = p_uid and urd.catalog = p_catalog
      and d.embedding is not null
      and c.n > 0
  )
  select avg(embedding) from expanded;
$$;

create or replace function public.weighted_taste_umap(p_uid uuid, p_catalog text)
returns table (umap_x double precision, umap_y double precision)
language sql
stable
as $$
  with cnt as (
    select count(*)::int as n
    from public.user_ranked_dramas urd
    where urd.user_id = p_uid and urd.catalog = p_catalog
  ),
  parts as (
    select
      d.umap_x * ((c.n - urd.rank + 1)::float8) as px,
      d.umap_y * ((c.n - urd.rank + 1)::float8) as py,
      (c.n - urd.rank + 1)::float8 as wt
    from public.user_ranked_dramas urd
    cross join cnt c
    join public.dramas d on d.id = urd.drama_id
    where urd.user_id = p_uid and urd.catalog = p_catalog
      and d.umap_x is not null and d.umap_y is not null
      and c.n > 0
  ),
  agg as (
    select sum(px) as spx, sum(py) as spy, sum(wt) as swt from parts
  )
  select
    case when coalesce((select swt from agg), 0) > 0 then (select spx / swt from agg) else null end,
    case when coalesce((select swt from agg), 0) > 0 then (select spy / swt from agg) else null end;
$$;

-- Cache taste on profiles (trigger-maintained)
create or replace function public.refresh_profile_taste(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emb vector(384);
  v_ux double precision;
  v_uy double precision;
begin
  v_emb := public.weighted_taste_embedding(p_uid, 'asian');
  select umap_x, umap_y into v_ux, v_uy from public.weighted_taste_umap(p_uid, 'asian');

  update public.profiles
  set
    taste_embedding = v_emb,
    taste_umap_x = v_ux,
    taste_umap_y = v_uy,
    taste_updated_at = now()
  where id = p_uid;
end;
$$;

create or replace function public.tg_refresh_profile_taste()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_profile_taste(old.user_id);
  else
    perform public.refresh_profile_taste(new.user_id);
  end if;
  return null;
end;
$$;

create trigger user_ranked_dramas_refresh_taste
  after insert or update or delete on public.user_ranked_dramas
  for each row execute function public.tg_refresh_profile_taste();

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

-- RPC: recommendations from weighted taste embedding
create or replace function public.get_user_recommendations(p_limit int default 50)
returns setof public.dramas
language sql
stable
as $$
  with user_vec as (
    select public.weighted_taste_embedding(auth.uid(), 'asian') as embedding
  )
  select d.*
  from public.dramas d, user_vec u
  where d.embedding is not null
    and u.embedding is not null
    and not exists (
      select 1 from public.user_ranked_dramas urd
      where urd.user_id = auth.uid() and urd.catalog = 'asian' and urd.drama_id = d.id
    )
  order by d.embedding <=> u.embedding
  limit p_limit;
$$;

-- RPC: user UMAP position (from cached profile, maintained by trigger)
create or replace function public.get_user_umap_position()
returns table (umap_x double precision, umap_y double precision)
language sql
stable
as $$
  select pr.taste_umap_x, pr.taste_umap_y
  from public.profiles pr
  where pr.id = auth.uid();
$$;

-- Internal helpers + refresh: not for direct client calls (triggers still run as owner)
revoke all on function public.weighted_taste_embedding(uuid, text) from public;
revoke all on function public.weighted_taste_umap(uuid, text) from public;
revoke all on function public.refresh_profile_taste(uuid) from public;
