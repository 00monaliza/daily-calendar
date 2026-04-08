-- supabase/migrations/004_property_sort_order.sql
alter table properties add column if not exists sort_order integer;

update properties
set sort_order = sub.rn
from (
  select id,
         row_number() over (partition by owner_id order by created_at) - 1 as rn
  from   properties
) sub
where properties.id = sub.id;
