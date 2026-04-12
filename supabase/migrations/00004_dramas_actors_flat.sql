-- Denormalized string for ILIKE search over cast members.
-- Stored column + trigger (not GENERATED): array_to_string is STABLE, not IMMUTABLE, so Postgres rejects it for generated columns.

alter table public.dramas
  add column if not exists actors_flat text;

update public.dramas
set actors_flat = coalesce(array_to_string(coalesce(main_actors, '{}'), ' '), '')
where actors_flat is distinct from coalesce(array_to_string(coalesce(main_actors, '{}'), ' '), '');

create or replace function public.dramas_set_actors_flat()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.actors_flat := coalesce(array_to_string(coalesce(new.main_actors, '{}'), ' '), '');
  return new;
end;
$$;

drop trigger if exists dramas_set_actors_flat on public.dramas;
create trigger dramas_set_actors_flat
  before insert or update of main_actors on public.dramas
  for each row
  execute procedure public.dramas_set_actors_flat();

create index if not exists dramas_actors_flat_trgm_idx
  on public.dramas using gin (actors_flat gin_trgm_ops);
