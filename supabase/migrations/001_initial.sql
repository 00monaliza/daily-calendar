-- Профиль владельца
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone text,
  created_at timestamptz default now()
);

-- Квартиры
create table properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  address text,
  rooms integer default 1,
  base_price integer not null,
  description text,
  color text default '#376E6F',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Бронирования
create table bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  guest_name text not null,
  guest_phone text,
  check_in date not null,
  check_out date not null,
  total_price integer not null,
  prepayment integer default 0,
  payment_status text check (payment_status in ('waiting','partial','paid')) default 'waiting',
  source text check (source in ('direct','kaspi','booking','airbnb','avito','other')) default 'direct',
  comment text,
  created_at timestamptz default now()
);

-- Расходы
create table expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade not null,
  amount integer not null,
  category text check (category in ('cleaning','repair','furniture','utilities','other')) default 'other',
  description text,
  date date not null,
  created_at timestamptz default now()
);
