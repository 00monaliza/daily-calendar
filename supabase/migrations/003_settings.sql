create table settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  date_format    text    not null default 'DD.MM.YYYY',
  week_start     text    not null default 'monday',
  timezone       text    not null default 'Asia/Almaty',
  show_full_text boolean not null default true,
  compact_mode   boolean not null default false
);

alter table settings enable row level security;
create policy "own_settings" on settings using (auth.uid() = user_id) with check (auth.uid() = user_id);
