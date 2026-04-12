-- Batch-update poster URLs from JSON import (called by scripts/update-drama-images.mjs with service role).

create or replace function public.apply_drama_image_batch(rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with data as (
    select
      nullif(trim(elem->>'link'), '') as link,
      nullif(trim(elem->>'image_url'), '') as image_url
    from jsonb_array_elements(rows) as elem
  )
  update public.dramas d
  set
    image_url = data.image_url,
    updated_at = now()
  from data
  where d.link is not null
    and data.link is not null
    and d.link = data.link;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.apply_drama_image_batch(jsonb) from public;
grant execute on function public.apply_drama_image_batch(jsonb) to service_role;
