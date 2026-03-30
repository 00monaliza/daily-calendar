-- RLS: владелец видит только свои данные
alter table profiles enable row level security;
alter table properties enable row level security;
alter table bookings enable row level security;
alter table expenses enable row level security;

create policy "own_profile" on profiles using (auth.uid() = id);
create policy "own_properties" on properties using (auth.uid() = owner_id);
create policy "own_bookings" on bookings using (auth.uid() = owner_id);
create policy "own_expenses" on expenses using (auth.uid() = owner_id);

-- Trigger: auto-create profile on signup
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure handle_new_user();
