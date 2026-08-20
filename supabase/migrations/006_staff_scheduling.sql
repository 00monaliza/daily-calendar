-- Штат: сотрудники и график смен (отдельный продукт от properties/bookings,
-- см. docs/superpowers/specs/2026-08-21-staff-scheduling-design.md)

create table staff_employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  full_name text not null,
  position text,
  login text not null check (login ~ '^[a-z0-9]+$'),
  auth_user_id uuid references auth.users(id) on delete set null,
  is_active boolean default true,
  sort_order integer,
  created_at timestamptz default now()
);

-- Global uniqueness (not per-owner): login maps 1:1 to a synthetic email
-- that must be unique across the whole Supabase Auth project (see ADR-0003).
create unique index staff_employees_login_unique on staff_employees (login);

create table staff_shifts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade not null,
  employee_id uuid references staff_employees(id) on delete cascade not null,
  -- Denormalized copy of staff_employees.auth_user_id, kept in sync by the
  -- application on write, so the employee-read RLS policy below is a plain
  -- equality check instead of a subquery (see ADR-0003 / spec RLS section).
  auth_user_id uuid references auth.users(id) on delete set null,
  date date not null,
  start_time time,
  end_time time,
  status text check (status in ('work', 'day_off', 'vacation', 'sick')) not null default 'work',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One entry per employee per day (no split shifts in this build).
create unique index staff_shifts_employee_date_unique on staff_shifts (employee_id, date);

alter table staff_employees enable row level security;
alter table staff_shifts enable row level security;

create policy "owner_full_access" on staff_employees
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "employee_reads_own_record" on staff_employees
  for select using (auth.uid() = auth_user_id);

create policy "owner_full_access" on staff_shifts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "employee_reads_own_shifts" on staff_shifts
  for select using (auth.uid() = auth_user_id);
