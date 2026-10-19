-- Голосовая бронь: короткие названия квартир, личный токен для iOS Shortcut
-- и черновики броней, которые ждут подтверждения в приложении.

alter table properties
add column if not exists voice_aliases text[] not null default '{}';

-- Токен хранится только в виде sha256-хэша: сам токен показывается
-- пользователю один раз и вставляется в Shortcut.
create table if not exists voice_tokens (
  owner_id   uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table voice_tokens enable row level security;
drop policy if exists "own_voice_token" on voice_tokens;
create policy "own_voice_token" on voice_tokens
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists voice_booking_drafts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  transcript   text not null,
  parsed       jsonb not null,
  availability jsonb,
  status       text not null default 'pending' check (status in ('pending', 'used', 'dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists voice_booking_drafts_owner_status_idx
  on voice_booking_drafts (owner_id, status, created_at desc);

alter table voice_booking_drafts enable row level security;
drop policy if exists "own_voice_drafts" on voice_booking_drafts;
create policy "own_voice_drafts" on voice_booking_drafts
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Стартовые голосовые названия для существующих квартир. Срабатывает только
-- там, где псевдонимы ещё не заданы, поэтому миграцию безопасно повторять.
-- Квартиры называют короткими числами; диктовка iPhone пишет их то цифрами,
-- то словами, поэтому заданы оба варианта.
update properties set voice_aliases = array['89', 'восемьдесят девять']
where voice_aliases = '{}' and name ilike '%алматау%';

update properties set voice_aliases = array['12', 'двенадцать', 'двенадцатая']
where voice_aliases = '{}' and name ~* 'инжу' and name ~ '(^|[^0-9])12([^0-9]|$)';

update properties set voice_aliases = array['24', 'двадцать четыре', 'двадцать четвёртая']
where voice_aliases = '{}' and name ~* 'инжу' and name ~ '(^|[^0-9])24([^0-9]|$)';

update properties set voice_aliases = array['49', 'сорок девять']
where voice_aliases = '{}' and name ilike '%весна%';

update properties set voice_aliases = array['1509', 'пятнадцать ноль девять', 'тысяча пятьсот девять']
where voice_aliases = '{}' and name ~ '(^|[^0-9])1509([^0-9]|$)';

update properties set voice_aliases = array['2006', 'двадцать ноль шесть', 'две тысячи шесть']
where voice_aliases = '{}' and name ~ '(^|[^0-9])2006([^0-9]|$)';
